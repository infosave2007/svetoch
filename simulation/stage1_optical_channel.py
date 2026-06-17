"""
═══════════════════════════════════════════════════════════════════════
 NVG PureField PoC — Этап 1: ОПТИЧЕСКИЙ КАНАЛ
═══════════════════════════════════════════════════════════════════════

  Цель: доказать что камера Xiaomi 12 Lite видит OLED через зеркало
  и может различать отдельные пиксели.

  Эксперимент (на телефоне или эмуляция на компьютере):
  1. Генерируем тестовые паттерны (белый, чёрный, шахматка, градиент)
  2. Симулируем оптический канал (OLED → зеркало → камера)
  3. Измеряем SNR, контраст, разрешение
  4. Определяем реальный d_model

  Автор: NVG-Research / Oleg Kirichenko
"""

import numpy as np
import math
import os

# ═══════════════════════════════════════════════════════════════════
# ПАРАМЕТРЫ XIAOMI 12 LITE
# ═══════════════════════════════════════════════════════════════════

SCREEN_PX_W = 1080
SCREEN_PX_H = 2400
SCREEN_HZ = 120
OLED_PITCH_UM = 63.2       # мкм
OLED_GAMMA = 2.2            # нелинейность OLED

CAM_MP = 32e6
CAM_F = 2.5e-3              # фокусное расстояние, м
CAM_F_NUM = 2.5             # диафрагма
CAM_PIXEL_UM = 0.8          # мкм
CAM_SENSOR_W = 6531
CAM_SENSOR_H = 4898
CAM_FOV_DEG = 78
CAM_MIN_FOCUS_CM = 10       # мин. фокус, см
CAM_FULL_WELL = 4500        # e⁻
CAM_READ_NOISE = 3.0        # e⁻ RMS
CAM_QE = 0.50

MIRROR_D_CM = 5             # расстояние до зеркала, см
MIRROR_R = 0.90             # отражение зеркала
LAMBDA_NM = 530             # длина волны, нм
PHOTON_E = 6.626e-34 * 3e8 / (LAMBDA_NM * 1e-9)


def section(title):
    print(f"\n  ═══ {title} ═══\n")


# ═══════════════════════════════════════════════════════════════════
# 1. ГЕНЕРАЦИЯ ТЕСТОВЫХ ПАТТЕРНОВ
# ═══════════════════════════════════════════════════════════════════

def generate_test_patterns(size=64):
    """Генерируем набор тестовых паттернов для OLED экрана.
    
    size: размер паттерна (пикселей). Для PoC начинаем с маленького.
    Возвращает dict {имя: numpy array (size×size, float 0-1)}
    """
    patterns = {}
    
    # 1. Белый (все пиксели максимальной яркости)
    patterns['white'] = np.ones((size, size))
    
    # 2. Чёрный
    patterns['black'] = np.zeros((size, size))
    
    # 3. Серый 50%
    patterns['gray_50'] = np.full((size, size), 0.5)
    
    # 4. Шахматка 2×2
    checker = np.zeros((size, size))
    for i in range(size):
        for j in range(size):
            if (i + j) % 2 == 0:
                checker[i, j] = 1.0
    patterns['checkerboard_1px'] = checker
    
    # 5. Шахматка 4×4 (каждая клетка = 4 пикселя)
    checker4 = np.zeros((size, size))
    for i in range(size):
        for j in range(size):
            if ((i // 4) + (j // 4)) % 2 == 0:
                checker4[i, j] = 1.0
    patterns['checkerboard_4px'] = checker4
    
    # 6. Шахматка 8×8
    checker8 = np.zeros((size, size))
    for i in range(size):
        for j in range(size):
            if ((i // 8) + (j // 8)) % 2 == 0:
                checker8[i, j] = 1.0
    patterns['checkerboard_8px'] = checker8
    
    # 7. Горизонтальный градиент
    grad_h = np.tile(np.linspace(0, 1, size), (size, 1))
    patterns['gradient_h'] = grad_h
    
    # 8. Вертикальный градиент
    grad_v = np.tile(np.linspace(0, 1, size).reshape(-1, 1), (1, size))
    patterns['gradient_v'] = grad_v
    
    # 9. Случайный паттерн (для SNR теста)
    rng = np.random.RandomState(42)
    patterns['random'] = rng.rand(size, size)
    
    # 10. Синусоида (для MTF теста)
    x = np.linspace(0, 4 * np.pi, size)
    sin_pattern = 0.5 + 0.5 * np.sin(x)
    patterns['sine_4cycles'] = np.tile(sin_pattern, (size, 1))
    
    return patterns


# ═══════════════════════════════════════════════════════════════════
# 2. МОДЕЛЬ OLED → ЗЕРКАЛО → КАМЕРА
# ═══════════════════════════════════════════════════════════════════

def oled_emit(pattern, gamma=OLED_GAMMA):
    """OLED эмиссия: применяем γ-кривую.
    
    Вход: линейные значения 0-1 (яркость, которую мы хотим)
    Выход: интенсивность света (с учётом OLED γ)
    
    В реальном OLED: L = L_max · (V/V_max)^γ
    Но для передачи линейных данных делаем γ-коррекцию:
    display_value = pattern^(1/γ), тогда OLED излучит pattern^(1/γ·γ) = pattern
    """
    # Для PoC: отправляем pattern^(1/γ) → OLED выдаёт pattern^(1/γ)·γ = pattern
    corrected = np.clip(pattern, 0, 1) ** (1.0 / gamma)
    # OLED излучает: corrected^γ = pattern (восстанавливаем линейность)
    emitted = corrected ** gamma
    return emitted


def mirror_reflect(intensity, reflectivity=MIRROR_R):
    """Зеркало: ослабление на коэффициент R."""
    return intensity * reflectivity


def camera_capture(intensity, d_cm=MIRROR_D_CM, exposure_frames=1):
    """Модель камеры: фотоны → электроны → цифровое значение.
    
    intensity: 2D массив интенсивностей (нормализованных)
    d_cm: расстояние до зеркала
    exposure_frames: сколько кадров интегрируем (при 120 Гц)
    
    Возвращает: (digital_values, snr_map)
    """
    d_m = d_cm / 100.0
    virt_d = 2 * d_m
    
    # Оптическая мощность на пиксель
    oled_power = 0.35e-6  # Вт/субпиксель при макс яркости
    
    # Телесный угол линзы камеры
    lens_d = CAM_F / CAM_F_NUM
    lens_area = math.pi * (lens_d / 2)**2
    solid_angle = lens_area / virt_d**2
    
    # Фотоны на OLED-пиксель на кадр
    photons_per_frame = oled_power * solid_angle / PHOTON_E / SCREEN_HZ
    
    # Масштабируем по интенсивности
    photons = intensity * photons_per_frame * exposure_frames
    
    # Квантовая эффективность → электроны
    electrons = photons * CAM_QE
    
    # Shot noise (Пуассоновский)
    rng = np.random.RandomState(123)
    electrons_noisy = rng.poisson(np.maximum(electrons, 0).astype(np.float64))
    
    # Read noise (гауссовский)
    electrons_noisy = electrons_noisy + rng.normal(0, CAM_READ_NOISE, electrons.shape)
    
    # Clamp to full well capacity
    electrons_noisy = np.clip(electrons_noisy, 0, CAM_FULL_WELL)
    
    # ADC → цифровое значение (10 бит = 0-1023)
    adc_bits = 10
    digital = (electrons_noisy / CAM_FULL_WELL * (2**adc_bits - 1)).astype(int)
    
    # SNR для каждого пикселя
    signal = np.maximum(electrons, 1)
    noise = np.sqrt(signal + CAM_READ_NOISE**2)
    snr_map = signal / noise
    
    return digital, snr_map, electrons


def optical_channel(pattern, d_cm=MIRROR_D_CM):
    """Полный оптический канал: OLED → зеркало → камера."""
    emitted = oled_emit(pattern)
    reflected = mirror_reflect(emitted)
    digital, snr_map, electrons = camera_capture(reflected, d_cm)
    return digital, snr_map, electrons


# ═══════════════════════════════════════════════════════════════════
# 3. ТЕСТЫ
# ═══════════════════════════════════════════════════════════════════

def test_linearity(patterns):
    """Тест линейности: серый 50% = 0.5 × белый?"""
    section("ТЕСТ 1: ЛИНЕЙНОСТЬ")
    
    dig_white, _, e_white = optical_channel(patterns['white'])
    dig_black, _, e_black = optical_channel(patterns['black'])
    dig_gray, _, e_gray = optical_channel(patterns['gray_50'])
    
    mean_white = np.mean(e_white)
    mean_black = np.mean(e_black)
    mean_gray = np.mean(e_gray)
    
    expected_gray = mean_white * 0.5
    linearity_error = abs(mean_gray - expected_gray) / expected_gray * 100
    
    print(f"    Белый:  {mean_white:.0f} e⁻")
    print(f"    Чёрный: {mean_black:.0f} e⁻")
    print(f"    Серый:  {mean_gray:.0f} e⁻ (ожидалось {expected_gray:.0f})")
    print(f"    Ошибка линейности: {linearity_error:.1f}%")
    
    if linearity_error < 5:
        print(f"    ✅ Линейность OK (ошибка < 5%)")
    else:
        print(f"    ⚠️ Нелинейность > 5% — нужна калибровка γ")
    
    return linearity_error


def test_contrast(patterns):
    """Тест контраста: шахматка различима?"""
    section("ТЕСТ 2: КОНТРАСТ (MTF)")
    
    results = {}
    for name in ['checkerboard_1px', 'checkerboard_4px', 'checkerboard_8px']:
        dig, snr, e = optical_channel(patterns[name])
        
        # Michelson contrast: (max - min) / (max + min)
        i_max = np.mean(e[patterns[name] > 0.5])
        i_min = np.mean(e[patterns[name] <= 0.5])
        contrast = (i_max - i_min) / (i_max + i_min) if (i_max + i_min) > 0 else 0
        
        px_size = int(name.split('_')[1].replace('px', ''))
        results[name] = contrast
        
        status = "✅" if contrast > 0.5 else ("⚠️" if contrast > 0.1 else "❌")
        print(f"    {name:<22} | Контраст: {contrast:.3f} | "
              f"Размер клетки: {px_size} пкс | {status}")
    
    return results


def test_snr(patterns):
    """Тест SNR: сколько бит информации в канале?"""
    section("ТЕСТ 3: SNR")
    
    dig, snr_map, e = optical_channel(patterns['random'])
    
    mean_snr = np.mean(snr_map)
    min_snr = np.min(snr_map)
    max_snr = np.max(snr_map)
    mean_bits = math.log2(max(mean_snr, 1))
    
    print(f"    SNR средний: {mean_snr:.0f} ({mean_bits:.1f} бит)")
    print(f"    SNR мин:     {min_snr:.0f}")
    print(f"    SNR макс:    {max_snr:.0f}")
    print()
    
    # Гистограмма SNR по уровням яркости
    print(f"    {'Яркость':<10} | {'Электронов':<12} | {'SNR':<8} | {'Бит':<6}")
    print(f"    {'─'*45}")
    for level in [0.1, 0.25, 0.5, 0.75, 1.0]:
        p = np.full((8, 8), level)
        _, snr_l, e_l = optical_channel(p)
        s = np.mean(snr_l)
        b = math.log2(max(s, 1))
        print(f"    {level:<10.2f} | {np.mean(e_l):<12.0f} | {s:<8.0f} | {b:<6.1f}")
    
    print()
    if mean_bits >= 8:
        print(f"    ✅ SNR ≥ 8 бит — достаточно для INT8 весов!")
    elif mean_bits >= 4:
        print(f"    ⚠️ SNR ≥ 4 бит — достаточно для INT4 квантизации")
    else:
        print(f"    ❌ SNR < 4 бит — недостаточно")
    
    return mean_bits


def test_resolution(patterns):
    """Тест разрешения: какой минимальный паттерн камера различает?"""
    section("ТЕСТ 4: РАЗРЕШЕНИЕ (d_model)")
    
    # Тестируем шахматки разного размера
    sizes = [1, 2, 4, 8, 16, 32]
    size = 64
    
    print(f"    {'Клетка, px':<12} | {'Контраст':<10} | {'Различим?':<10} | {'d_model':<8}")
    print(f"    {'─'*50}")
    
    best_d_model = 0
    
    for cell in sizes:
        pattern = np.zeros((size, size))
        for i in range(size):
            for j in range(size):
                if ((i // cell) + (j // cell)) % 2 == 0:
                    pattern[i, j] = 1.0
        
        _, _, e = optical_channel(pattern)
        
        i_max = np.mean(e[pattern > 0.5])
        i_min = np.mean(e[pattern <= 0.5])
        contrast = (i_max - i_min) / (i_max + i_min) if (i_max + i_min) > 0 else 0
        
        resolvable = contrast > 0.3
        d_model = SCREEN_PX_W // cell if resolvable else 0
        
        if resolvable and d_model > best_d_model:
            best_d_model = d_model
        
        status = "✅" if resolvable else "❌"
        print(f"    {cell:<12} | {contrast:<10.3f} | {status:<10} | {d_model if resolvable else '—':<8}")
    
    print(f"\n    ★ Реальный d_model = {best_d_model}")
    return best_d_model


def test_reproducibility():
    """Тест воспроизводимости: один и тот же паттерн = один и тот же результат?"""
    section("ТЕСТ 5: ВОСПРОИЗВОДИМОСТЬ")
    
    pattern = np.random.RandomState(42).rand(32, 32)
    
    results = []
    for trial in range(5):
        dig, _, _ = optical_channel(pattern)
        results.append(dig.astype(float))
    
    # Средний пиксель и вариация
    mean_result = np.mean(results, axis=0)
    std_result = np.std(results, axis=0)
    
    mean_std = np.mean(std_result)
    max_std = np.max(std_result)
    
    # Корреляция между прогонами
    corr = np.corrcoef(results[0].flatten(), results[1].flatten())[0, 1]
    
    print(f"    5 прогонов одного паттерна:")
    print(f"    Средняя σ (пиксель): {mean_std:.2f} LSB")
    print(f"    Макс σ: {max_std:.2f} LSB")
    print(f"    Корреляция прогонов: {corr:.6f}")
    
    # Примечание: в нашей симуляции random seed фиксирован → идеальная воспроизводимость
    # В реальном эксперименте будут вариации от shot noise
    print(f"\n    Примечание: в симуляции seed фиксирован.")
    print(f"    В реальном эксперименте shot noise даст σ ≈ √N ≈ {math.sqrt(np.mean(mean_result)*CAM_FULL_WELL/1023):.0f} e⁻")


# ═══════════════════════════════════════════════════════════════════
# MAIN
# ═══════════════════════════════════════════════════════════════════

def main():
    print("=" * 78)
    print("  NVG PUREFIELD PoC — ЭТАП 1: ОПТИЧЕСКИЙ КАНАЛ")
    print("  Xiaomi 12 Lite + Зеркало на 5 см")
    print("=" * 78)
    
    # Генерируем паттерны
    section("ГЕНЕРАЦИЯ ТЕСТОВЫХ ПАТТЕРНОВ")
    patterns = generate_test_patterns(size=64)
    print(f"    Создано {len(patterns)} тестовых паттернов:")
    for name, p in patterns.items():
        print(f"      {name:<22} {p.shape} | min={p.min():.2f} max={p.max():.2f} mean={p.mean():.2f}")
    
    # Тесты
    linearity_err = test_linearity(patterns)
    contrast_results = test_contrast(patterns)
    snr_bits = test_snr(patterns)
    d_model = test_resolution(patterns)
    test_reproducibility()
    
    # Итог
    section("★ ИТОГ ЭТАПА 1")
    
    print(f"  ╔════════════════════════════════════════════════════════════════╗")
    print(f"  ║  ЭТАП 1: ОПТИЧЕСКИЙ КАНАЛ — РЕЗУЛЬТАТЫ                     ║")
    print(f"  ╠════════════════════════════════════════════════════════════════╣")
    print(f"  ║                                                                ║")
    print(f"  ║  Линейность:      ошибка {linearity_err:.1f}%  {'✅' if linearity_err < 5 else '⚠️'}                       ║")
    print(f"  ║  Контраст (1px):  {contrast_results.get('checkerboard_1px', 0):.3f}    {'✅' if contrast_results.get('checkerboard_1px', 0) > 0.5 else '⚠️'}                       ║")
    print(f"  ║  SNR:             {snr_bits:.1f} бит      {'✅' if snr_bits >= 8 else '⚠️'}                       ║")
    print(f"  ║  d_model:         {d_model}          {'✅' if d_model >= 128 else '⚠️'}                       ║")
    print(f"  ║                                                                ║")
    
    all_pass = linearity_err < 5 and snr_bits >= 4 and d_model >= 64
    if all_pass:
        print(f"  ║  ★ ВСЕ ТЕСТЫ ПРОЙДЕНЫ → ПЕРЕХОДИМ К ЭТАПУ 2!            ║")
    else:
        print(f"  ║  ⚠️ Есть проблемы → нужна калибровка                      ║")
    print(f"  ║                                                                ║")
    print(f"  ╚════════════════════════════════════════════════════════════════╝")


if __name__ == '__main__':
    main()
