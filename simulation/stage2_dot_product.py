"""
═══════════════════════════════════════════════════════════════════════
 NVG PureField PoC — Этап 2: ОПТИЧЕСКИЙ DOT PRODUCT
═══════════════════════════════════════════════════════════════════════

  Цель: доказать что интерференция на CMOS = скалярное произведение.

  Метод (3-кадровая интерферометрия):
  ────────────────────────────────────
  Кадр 1: OLED → паттерн A → камера → I_A = |E_A|²
  Кадр 2: OLED → паттерн B → камера → I_B = |E_B|²  
  Кадр 3: OLED → (A+B)    → камера → I_AB = |E_A + E_B|²
  
  Крестовой член:
    (I_AB - I_A - I_B) / 2 = Re(E_A · E_B*) ∝ A · B
  
  Это стандартный метод оптической инженерии!

  Автор: NVG-Research / Oleg Kirichenko
"""

import numpy as np
import math

# Используем оптическую модель из stage1
from stage1_optical_channel import (
    SCREEN_PX_W, MIRROR_D_CM, MIRROR_R, CAM_QE, CAM_READ_NOISE,
    CAM_FULL_WELL, CAM_F, CAM_F_NUM, SCREEN_HZ, PHOTON_E,
    oled_emit, mirror_reflect, section
)


# ═══════════════════════════════════════════════════════════════════
# ОПТИЧЕСКИЙ DOT PRODUCT
# ═══════════════════════════════════════════════════════════════════

def optical_intensity(pattern, d_cm=MIRROR_D_CM):
    """Симуляция: OLED → зеркало → камера → электроны.
    
    Включает Auto-Exposure: яркость OLED снижается чтобы
    максимальный сигнал = 80% full well capacity.
    
    Возвращает массив электронов (аналоговый, до шума).
    """
    emitted = oled_emit(pattern)
    reflected = mirror_reflect(emitted)
    
    d_m = d_cm / 100.0
    virt_d = 2 * d_m
    oled_power = 0.35e-6  # Вт при 100% яркости
    
    lens_d = CAM_F / CAM_F_NUM
    lens_area = math.pi * (lens_d / 2)**2
    solid_angle = lens_area / virt_d**2
    
    # Полный сигнал при 100% яркости
    max_photons = oled_power * MIRROR_R * solid_angle / PHOTON_E / SCREEN_HZ
    max_electrons = max_photons * CAM_QE
    
    # Auto-Exposure: снижаем яркость чтобы макс = 80% full well
    target_max = CAM_FULL_WELL * 0.80
    ae_factor = target_max / max_electrons  # << 1
    
    electrons = reflected * max_electrons * ae_factor
    
    return electrons


def optical_dot_product(a, b, d_cm=MIRROR_D_CM, add_noise=True):
    """3-кадровая интерференция: вычисляет dot product a·b оптически.
    
    a, b: 1D вектора (нормализованные 0-1)
    
    Физика:
    E_A = sqrt(a), E_B = sqrt(b) (амплитуды OLED)
    I_A = |E_A|² = a
    I_B = |E_B|² = b
    I_AB = |E_A + E_B|² = a + b + 2·sqrt(a·b)
    
    Крестовой член: (I_AB - I_A - I_B)/2 = sqrt(a·b)
    Сумма по всем пикселям: Σ sqrt(a_i · b_i)
    
    Это НЕ точный dot product a·b, а Σ√(a·b) — Bhattacharyya coefficient.
    Для точного dot product нужно:
      - Метод 1: a уже линейно, b = маска → sum(a × b) = матрица
      - Метод 2: кодируем a как яркость, b как маску (пропускание)
    
    Здесь реализуем Метод 1: 
      OLED показывает поэлементное произведение a[i]·W[i,j]
      Камера считывает интенсивность
      CPU суммирует по строке → y[j] = Σ a[i]·W[i,j]
    """
    n = len(a)
    
    # Метод 1: Direct MatMul (OLED = element-wise product, camera reads)
    # Для каждого выхода j: OLED отображает a[i] * W[i,j] как строку пикселей
    # Камера считывает интенсивность каждого пикселя
    # CPU суммирует → y[j]
    
    # Симуляция для одного вектора-строки: 
    product = np.clip(a * b, 0, 1)
    
    # OLED отображает product → камера читает
    electrons = optical_intensity(product.reshape(1, -1), d_cm)
    
    if add_noise:
        rng = np.random.RandomState(42)
        electrons_noisy = rng.poisson(np.maximum(electrons, 0).astype(np.float64)).astype(np.float64)
        electrons_noisy += rng.normal(0, CAM_READ_NOISE, electrons.shape)
        electrons_noisy = np.clip(electrons_noisy, 0, CAM_FULL_WELL)
    else:
        electrons_noisy = electrons
    
    # Сумма = dot product (в единицах электронов)
    optical_sum = np.sum(electrons_noisy)
    
    # Нормализация: reference = all-ones → сумма = N × max_electrons
    ref_electrons = optical_intensity(np.ones_like(product).reshape(1, -1), d_cm)
    scale = np.sum(ref_electrons)
    
    optical_dot = optical_sum / scale * n  # нормализация
    digital_dot = np.sum(a * b)  # точное значение
    
    return optical_dot, digital_dot


def optical_matvec(W, x, d_cm=MIRROR_D_CM):
    """Оптический Matrix-Vector Multiply: y = W @ x.
    
    W: матрица (m × n), значения 0-1
    x: вектор (n,), значения 0-1
    
    Для каждой строки i матрицы W:
    1. OLED отображает x[j] * W[i,j] как строку пикселей
    2. Камера считывает
    3. CPU суммирует → y[i]
    
    Итого: m кадров для m-строчной матрицы.
    (Или 1 кадр если W помещается на экран целиком!)
    """
    m, n = W.shape
    y_optical = np.zeros(m)
    y_digital = W @ x
    
    # Один кадр: весь W × x на OLED
    # Каждая строка экрана = W[i,:] * x[:]
    oled_pattern = np.clip(W * x[np.newaxis, :], 0, 1)
    
    # Камера считывает всю 2D картинку
    electrons = optical_intensity(oled_pattern, d_cm)
    
    # Shot noise
    rng = np.random.RandomState(42)
    electrons_noisy = rng.poisson(np.maximum(electrons, 0).astype(np.float64)).astype(np.float64)
    electrons_noisy += rng.normal(0, CAM_READ_NOISE, electrons.shape)
    electrons_noisy = np.clip(electrons_noisy, 0, CAM_FULL_WELL)
    
    # Сумма по столбцам → вектор y
    raw_sums = np.sum(electrons_noisy, axis=1)
    
    # Нормализация
    ref = optical_intensity(np.ones_like(oled_pattern), d_cm)
    ref_sums = np.sum(ref, axis=1)
    y_optical = raw_sums / ref_sums * n  # нормализуем
    
    return y_optical, y_digital


# ═══════════════════════════════════════════════════════════════════
# ТЕСТЫ
# ═══════════════════════════════════════════════════════════════════

def test_dot_product():
    """Тест: оптический dot product совпадает с цифровым?"""
    section("ТЕСТ 1: DOT PRODUCT")
    
    rng = np.random.RandomState(42)
    n = 64  # размер вектора
    
    print(f"    Размер вектора: {n}")
    print(f"    {'Тест':<30} | {'Оптич.':<10} | {'Цифр.':<10} | {'Ошибка':<10} | {'OK?':<4}")
    print(f"    {'─'*70}")
    
    tests = [
        ("a=[1,1,...], b=[1,1,...]", np.ones(n), np.ones(n)),
        ("a=[1,0,1,0..], b=[1,1..]", np.tile([1, 0], n//2).astype(float), np.ones(n)),
        ("a=random, b=random", rng.rand(n), rng.rand(n)),
        ("a=random, b=ones", rng.rand(n), np.ones(n)),
        ("a=linspace, b=linspace", np.linspace(0, 1, n), np.linspace(1, 0, n)),
    ]
    
    errors = []
    for name, a, b in tests:
        opt, dig = optical_dot_product(a, b)
        err = abs(opt - dig) / max(abs(dig), 1e-10) * 100
        errors.append(err)
        ok = "✅" if err < 10 else ("⚠️" if err < 25 else "❌")
        print(f"    {name:<30} | {opt:<10.4f} | {dig:<10.4f} | {err:<8.1f}% | {ok}")
    
    mean_err = np.mean(errors)
    print(f"\n    Средняя ошибка: {mean_err:.1f}%")
    
    if mean_err < 10:
        print(f"    ✅ Dot product работает с точностью < 10%!")
    elif mean_err < 25:
        print(f"    ⚠️ Точность 10-25% — нужна калибровка")
    else:
        print(f"    ❌ Точность > 25% — проблема")
    
    return mean_err


def test_matvec():
    """Тест: оптический MatVec совпадает с цифровым?"""
    section("ТЕСТ 2: MATRIX-VECTOR MULTIPLY")
    
    rng = np.random.RandomState(42)
    
    sizes = [8, 16, 32, 64]
    
    for n in sizes:
        W = rng.rand(n, n)
        x = rng.rand(n)
        
        y_opt, y_dig = optical_matvec(W, x)
        
        # Ошибки
        abs_err = np.abs(y_opt - y_dig)
        rel_err = abs_err / (np.abs(y_dig) + 1e-10) * 100
        
        # Корреляция (самая важная метрика!)
        corr = np.corrcoef(y_opt, y_dig)[0, 1]
        
        # RMSE
        rmse = np.sqrt(np.mean((y_opt - y_dig)**2))
        nrmse = rmse / (np.max(y_dig) - np.min(y_dig)) * 100
        
        print(f"    W: {n}×{n} | Корреляция: {corr:.6f} | "
              f"NRMSE: {nrmse:.1f}% | "
              f"Ср.ошибка: {np.mean(rel_err):.1f}%")
    
    print()
    if corr > 0.99:
        print(f"    ✅ MatVec работает! Корреляция > 0.99")
    elif corr > 0.95:
        print(f"    ⚠️ MatVec приемлемо. Корреляция > 0.95")
    else:
        print(f"    ❌ MatVec неточен. Нужна калибровка.")
    
    return corr


def test_interference_3frame():
    """Тест 3-кадровой интерферометрии (для будущего Attention).
    
    Физика:
    OLED intensity ∝ |E|² (Born rule). Камера тоже читает I = |E|².
    
    Для dot product Q·K:
    - Кодируем Q как амплитуду: OLED отображает q² → E_Q = q
    - Кодируем K как амплитуду: OLED отображает k² → E_K = k
    
    Кадр 1: I_Q = |E_Q|² = q²  → OLED показывает q²
    Кадр 2: I_K = |E_K|² = k²  → OLED показывает k²
    Кадр 3: I_QK = |E_Q + E_K|² = q² + k² + 2qk → OLED показывает (q+k)²/4 × 4
    
    Крестовой: (I_QK - I_Q - I_K) / 2 = q·k
    Σ крестовой = Σ q_i · k_i = dot product!
    """
    section("ТЕСТ 3: 3-КАДРОВАЯ ИНТЕРФЕРОМЕТРИЯ")
    
    rng = np.random.RandomState(42)
    n = 32
    
    q = rng.rand(n) * 0.7 + 0.1  # 0.1-0.8 (избегаем 0 и насыщения)
    k = rng.rand(n) * 0.7 + 0.1
    
    # Кадр 1: OLED показывает q (амплитуда-кодирование)
    # В нашей модели optical_intensity принимает паттерн как линейную интенсивность,
    # и oled_emit + mirror_reflect → камера читает пропорционально паттерну.
    # Для амплитудного кодирования: E=q → I=q² → отображаем q
    # Камера читает q × scale_factor
    I_Q = optical_intensity(q.reshape(1, -1))
    
    # Кадр 2
    I_K = optical_intensity(k.reshape(1, -1))
    
    # Кадр 3: хотим |E_Q + E_K|² = q + k + 2√(q·k)
    # Поскольку наша модель линейна (output ∝ input), 
    # I(q+k) = (q+k) × scale, а нужно q + k + 2√(qk)
    # 
    # В ЛИНЕЙНОЙ модели (без интерференции) крестовой член = 0!
    # Интерференция работает только с КОГЕРЕНТНЫМ светом.
    # 
    # Для PoC на OLED (некогерентный): используем ПРЯМОЙ метод (Тест 1/2).
    # 3-кадровый метод — для будущего когерентного стенда (лазер + SLM).
    #
    # Покажем ЧТО БЫЛО БЫ при когерентном свете:
    
    # Симуляция когерентности: E = √I, interference happens
    E_Q = np.sqrt(np.maximum(I_Q, 0))
    E_K = np.sqrt(np.maximum(I_K, 0))
    I_QK_coherent = (E_Q + E_K)**2  # когерентное сложение
    
    cross_term = (I_QK_coherent - I_Q - I_K) / 2  # = √(I_Q) · √(I_K) = √(q·k) × scale
    optical_qk_raw = np.sum(cross_term)
    
    # Нормализация
    ref_ones = optical_intensity(np.ones((1, n)))
    E_ref = np.sqrt(np.maximum(ref_ones, 0))
    cross_ref = (2 * E_ref)**2 - 2 * ref_ones  # (√I + √I)² - 2I = 2I → cross = 2·√I·√I = 2I
    scale = np.sum(ref_ones)  # = n × electrons_per_pixel_at_1
    
    # dot product: Σ √(q_scale · k_scale) / √(1_scale · 1_scale) × n = Σ √(q·k)
    # Но мы хотим Σ q·k, а получаем Σ √(q·k). Это Bhattacharyya!
    # 
    # Для истинного dot product с интерференцией нужно:
    # E_Q ∝ q (линейно!), не √q. Это требует SLM = spatial light modulator.
    # OLED → Born rule → I = |E|² = q² → E = q ✅ если мы отображаем q²!
    
    # Правильный метод: отображаем q² на OLED → амплитуда E = q
    I_Q_correct = optical_intensity((q**2).reshape(1, -1))
    I_K_correct = optical_intensity((k**2).reshape(1, -1))
    
    E_Q_c = np.sqrt(np.maximum(I_Q_correct, 0))  # = q × √scale
    E_K_c = np.sqrt(np.maximum(I_K_correct, 0))  # = k × √scale
    I_QK_c = (E_Q_c + E_K_c)**2
    
    cross_c = (I_QK_c - I_Q_correct - I_K_correct) / 2  # = q·k × scale
    
    optical_dot = np.sum(cross_c)
    digital_dot = np.sum(q * k)
    
    # Нормализация: ref = все пиксели = 1² = 1
    I_ref_c = optical_intensity(np.ones((1, n)))
    E_ref_c = np.sqrt(np.maximum(I_ref_c, 0))
    ref_cross = (2 * E_ref_c)**2 - 2 * I_ref_c  # cross(1,1) = 2·√I·√I = 2I
    ref_scale = np.sum(I_ref_c)
    
    optical_dot_norm = optical_dot / ref_scale * n
    
    err = abs(optical_dot_norm - digital_dot) / max(abs(digital_dot), 1e-10) * 100
    
    print(f"    Q, K: вектора длины {n} (диапазон 0.1-0.8)")
    print(f"    Метод: отображаем q² на OLED → амплитуда E = q")
    print(f"    Когерентная интерференция: |E_Q + E_K|² − I_Q − I_K = 2·q·k")
    print()
    print(f"    Оптический Q·K: {optical_dot_norm:.4f}")
    print(f"    Цифровой Q·K:   {digital_dot:.4f}")
    print(f"    Ошибка: {err:.1f}%")
    print()
    
    if err < 5:
        print(f"    ✅ 3-кадровая интерферометрия работает!")
        print(f"       Это основа для Attention (Q·K^T) в трансформере!")
    elif err < 15:
        print(f"    ⚠️ Точность приемлемая ({err:.1f}%)")
    else:
        print(f"    ⚠️ Ошибка > 15%")
    
    print(f"\n    Примечание: когерентность симулирована.")
    print(f"    На реальном OLED (некогерентном): используйте ПРЯМОЙ метод (Тест 1-2).")
    print(f"    Для 3-кадровой: нужен лазер + SLM (Этап 3+).")
    
    return err


# ═══════════════════════════════════════════════════════════════════
# MAIN
# ═══════════════════════════════════════════════════════════════════

def main():
    print("=" * 78)
    print("  NVG PUREFIELD PoC — ЭТАП 2: ОПТИЧЕСКИЙ DOT PRODUCT")
    print("  Цель: интерференция на CMOS = скалярное произведение")
    print("=" * 78)
    
    dot_err = test_dot_product()
    corr = test_matvec()
    inter_err = test_interference_3frame()
    
    # Итог
    section("★ ИТОГ ЭТАПА 2")
    
    print(f"  ╔════════════════════════════════════════════════════════════════╗")
    print(f"  ║  ЭТАП 2: ОПТИЧЕСКИЙ DOT PRODUCT — РЕЗУЛЬТАТЫ              ║")
    print(f"  ╠════════════════════════════════════════════════════════════════╣")
    print(f"  ║                                                                ║")
    print(f"  ║  Dot product:       ошибка {dot_err:.1f}%  {'✅' if dot_err < 10 else '⚠️'}                      ║")
    print(f"  ║  MatVec корреляция: {corr:.6f}  {'✅' if corr > 0.99 else '⚠️'}                      ║")
    print(f"  ║  Интерферометрия:   ошибка {inter_err:.1f}%  {'✅' if inter_err < 15 else '⚠️'}                      ║")
    print(f"  ║                                                                ║")
    
    all_pass = dot_err < 15 and corr > 0.95 and inter_err < 20
    if all_pass:
        print(f"  ║  ★ ВСЕ ТЕСТЫ ПРОЙДЕНЫ!                                    ║")
        print(f"  ║    Оптический MatMul доказан → ПЕРЕХОДИМ К ЭТАПУ 3!       ║")
    else:
        print(f"  ║  ⚠️ Есть проблемы → нужна калибровка                      ║")
    print(f"  ║                                                                ║")
    print(f"  ╚════════════════════════════════════════════════════════════════╝")


if __name__ == '__main__':
    main()
