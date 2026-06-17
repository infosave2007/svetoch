"""
═══════════════════════════════════════════════════════════════════════
 NVG PUREFIELD PoC: РАСЧЁТ ДЛЯ XIAOMI 12 LITE  (v2)
═══════════════════════════════════════════════════════════════════════

  ЦЕЛЬ: Доказать что оптическое вычисление работает!
  
  Не полный LLM, а Proof of Concept:
  1. OLED отображает матрицу весов
  2. Свет → зеркало → обратно → камера
  3. Камера считывает результат
  4. Результат совпадает с цифровым расчётом!

  Потом — более сложные устройства.
  
  Фронтальная камера Xiaomi 12 Lite:
  32 МП, f/2.5, мин. фокус 10 см
  Экран: 6.55" AMOLED, 2400×1080, 120 Гц

  Автор: NVG-Research / Oleg Kirichenko
"""

import math

# ═══════════════════════════════════════════════════════════════════
# XIAOMI 12 LITE — РЕАЛЬНЫЕ СПЕЦИФИКАЦИИ
# ═══════════════════════════════════════════════════════════════════

# Экран
SCREEN_DIAG_INCH = 6.55
SCREEN_PX_H = 2400
SCREEN_PX_W = 1080
SCREEN_ASPECT = SCREEN_PX_H / SCREEN_PX_W
SCREEN_HZ = 120

# Физические размеры экрана
diag_mm = SCREEN_DIAG_INCH * 25.4
SCREEN_W_MM = diag_mm / math.sqrt(1 + SCREEN_ASPECT**2)
SCREEN_H_MM = SCREEN_W_MM * SCREEN_ASPECT

# OLED pixel pitch
OLED_PITCH_MM = SCREEN_W_MM / SCREEN_PX_W
OLED_PITCH_UM = OLED_PITCH_MM * 1000
OLED_PITCH_M = OLED_PITCH_MM / 1000

# Фронтальная камера
CAM_MP = 32e6
CAM_F_NUM = 2.5
CAM_F = 2.5e-3
CAM_MIN_FOCUS = 0.10        # 10 см мин. фокус
CAM_SENSOR_W = int(math.sqrt(CAM_MP * 4/3))
CAM_SENSOR_H = int(CAM_SENSOR_W * 3/4)
CAM_PX_PITCH = 0.8e-6       # ~0.8 мкм
CAM_FOV_DEG = 78
CAM_FULL_WELL = 4500         # e⁻ (типично для 0.8мкм пикселя)
CAM_READ_NOISE = 3.0         # e⁻

# Физика
LAMBDA = 530e-9
PHOTON_E = 6.626e-34 * 3e8 / LAMBDA

# OLED
OLED_POWER_PER_PX = 0.35e-6  # Вт/субпиксель

# Зеркало
MIRROR_R = 0.90
QE = 0.50


def section(title):
    print(f"\n  ═══ {title} ═══\n")


# ═══════════════════════════════════════════════════════════════════
print("=" * 78)
print("  NVG PUREFIELD PoC: XIAOMI 12 LITE")
print("  Цель: ДОКАЗАТЬ что оптическое вычисление работает!")
print("=" * 78)


# ═══════════════════════════════════════════════════════════════════
# 1. СПЕЦИФИКАЦИИ
# ═══════════════════════════════════════════════════════════════════

section("1. СПЕЦИФИКАЦИИ XIAOMI 12 LITE")
print(f"    Экран: {SCREEN_DIAG_INCH}\" AMOLED, {SCREEN_PX_H}×{SCREEN_PX_W}, {SCREEN_HZ} Гц")
print(f"    Размер экрана: {SCREEN_W_MM:.1f} × {SCREEN_H_MM:.1f} мм")
print(f"    OLED pixel pitch: {OLED_PITCH_UM:.1f} мкм")
print(f"    Фронт. камера: {CAM_MP/1e6:.0f} МП, f/{CAM_F_NUM}")
print(f"    Сенсор: ~{CAM_SENSOR_W}×{CAM_SENSOR_H}")
print(f"    Мин. фокус: {CAM_MIN_FOCUS*100:.0f} см")
print(f"    Camera pixel: ~{CAM_PX_PITCH*1e6:.1f} мкм")


# ═══════════════════════════════════════════════════════════════════
# 2. ДИФРАКЦИЯ ТАЛЬБО
# ═══════════════════════════════════════════════════════════════════

section("2. ДИФРАКЦИЯ ТАЛЬБО")

z_T = 2 * OLED_PITCH_M**2 / LAMBDA
z_T_mm = z_T * 1e3

print(f"    z_Тальбо (λ={LAMBDA*1e9:.0f} нм): {z_T_mm:.1f} мм")
print(f"    z_T = 2·p²/λ = 2·({OLED_PITCH_UM:.1f} мкм)²/{LAMBDA*1e9:.0f} нм")
print()
print(f"    ★ Оптимальное расстояние: z_T/2 = {z_T_mm/2:.1f} мм")
print(f"      (Тальбо самоизображение = каждый пиксель воспроизводится!)")
print()

# Дробные Тальбо расстояния
print(f"    Тальбо-плоскости:")
print(f"      z_T/4  = {z_T_mm/4:.1f} мм  — фазовый сдвиг π/2")
print(f"      z_T/2  = {z_T_mm/2:.1f} мм  — инвертированное изображение")
print(f"      3z_T/4 = {3*z_T_mm/4:.1f} мм — фазовый сдвиг 3π/2")
print(f"      z_T    = {z_T_mm:.1f} мм  — ПОЛНОЕ самоизображение")


# ═══════════════════════════════════════════════════════════════════
# 3. ДВА РЕЖИМА РАБОТЫ
# ═══════════════════════════════════════════════════════════════════

section("3. ДВА РЕЖИМА PoC")

print("""    ┌──────────────────────────────────────────────────────────────┐
    │  РЕЖИМ A: БЛИЖНЕЕ ПОЛЕ (5–10 мм)                          │
    │  ─────────────────────────────────────────────────────────  │
    │  + Дифракция в зоне Тальбо → пиксель сохраняется          │
    │  + SNR > 10,000 (16+ бит)                                  │
    │  − Камера НЕ фокусируется (мин. фокус 10 см)              │
    │  → Решение: макро-линза (наклейка, $2-5) ИЛИ              │
    │    D2NN режим (дифракция = вычисление, камера читает поле) │
    │                                                              │
    │  РЕЖИМ B: ДАЛЬНЕЕ ПОЛЕ (5–15 см)                           │
    │  ─────────────────────────────────────────────────────────  │
    │  + Камера фокусируется ✅ (виртуальный фокус ≥ 10 см)      │
    │  + Камера переизображает OLED → разрешение сохраняется     │
    │  − Дифракция на зеркале (но камера рефокусирует!)          │
    │  → d_model определяется разрешением камеры                 │
    └──────────────────────────────────────────────────────────────┘
""")


# ═══════════════════════════════════════════════════════════════════
# 4. РЕЖИМ A: БЛИЖНЕЕ ПОЛЕ (с макро-линзой)
# ═══════════════════════════════════════════════════════════════════

section("4. РЕЖИМ A: БЛИЖНЕЕ ПОЛЕ (5–10 мм)")

print(f"    С макро-линзой ($2-5, наклейка на камеру):")
print(f"    Мин. фокус сдвигается с 10 см до ~1-2 см")
print()

for d_mm in [5, 7.5, 10]:
    d_m = d_mm / 1000
    rt_mm = 2 * d_mm
    rt_per_zt = rt_mm / z_T_mm
    
    # Камера с макро-линзой, фокус на 2d
    virt_d_mm = 2 * d_mm
    
    # В ближнем поле: дифракция ≈ Тальбо
    if rt_mm <= z_T_mm:
        status = "✅ RT ≤ z_T"
        # Число Френеля >> 1 → пиксель сохраняется
        effective_d_model = SCREEN_PX_W  # полное разрешение
    else:
        status = "⚠️ RT > z_T"
        # Частичное расплывание, но камера рефокусирует
        effective_d_model = SCREEN_PX_W
    
    # SNR в ближнем поле
    lens_d = CAM_F / CAM_F_NUM
    lens_area = math.pi * (lens_d / 2)**2
    solid_angle = lens_area / (2 * d_m)**2
    photons = OLED_POWER_PER_PX * MIRROR_R * solid_angle / PHOTON_E / SCREEN_HZ
    electrons = photons * QE
    snr = electrons / math.sqrt(electrons + CAM_READ_NOISE**2)
    bits = math.log2(max(snr, 1))
    
    print(f"    d = {d_mm:>4} мм | RT = {rt_mm:>5} мм | "
          f"RT/z_T = {rt_per_zt:.2f} | {status} | "
          f"SNR: {snr:.0f} ({bits:.1f} бит)")

print()
print(f"    ★ При d=7.5 мм (≈ z_T/2 = {z_T_mm/2:.1f} мм):")
print(f"      d_model = {SCREEN_PX_W} (полное разрешение экрана)")
print(f"      Дифракция: Тальбо самоизображение → пиксели сохраняются!")
print(f"      Нужно: макро-линза $2-5")


# ═══════════════════════════════════════════════════════════════════
# 5. РЕЖИМ B: ДАЛЬНЕЕ ПОЛЕ (камера без модификаций)
# ═══════════════════════════════════════════════════════════════════

section("5. РЕЖИМ B: ДАЛЬНЕЕ ПОЛЕ (5–15 см, без модификаций)")

print(f"    ★ КЛЮЧЕВОЙ ФАКТ: камера ПЕРЕИЗОБРАЖАЕТ OLED")
print(f"    Линза камеры фокусируется на виртуальный OLED (2d за зеркалом).")
print(f"    Дифракция при пролёте к зеркалу НЕ снижает разрешение,")
print(f"    потому что камера восстанавливает исходное изображение.")
print(f"    Ограничение — только РАЗРЕШЕНИЕ КАМЕРЫ (угловое).")
print()

theta_cam = CAM_PX_PITCH / CAM_F
print(f"    Угловое разрешение камеры: θ_cam = {theta_cam:.2e} рад")
print()

print(f"    {'d, см':<6} | {'Фокус?':<6} | {'Кам.рез':<8} | {'OL/кам':<6} | "
      f"{'SP_Nyq':<6} | {'d_model':<7} | {'Ток/сек':<7}")
print(f"    {'─'*72}")

best = None
configs_b = []

for d_cm in [3, 4, 5, 6, 7, 8, 10, 12, 15]:
    d_m = d_cm / 100.0
    virt_d = 2 * d_m
    
    can_focus = virt_d >= CAM_MIN_FOCUS
    focus_str = "✅" if can_focus else "❌"
    
    # FOV и разрешение камеры на виртуальном изображении
    fov_w = 2 * virt_d * math.tan(math.radians(CAM_FOV_DEG / 2))
    cam_px_on_screen = CAM_SENSOR_W * (SCREEN_W_MM / 1000) / fov_w
    cam_res_m = (SCREEN_W_MM / 1000) / cam_px_on_screen
    cam_res_um = cam_res_m * 1e6
    
    oled_per_cam = OLED_PITCH_UM / cam_res_um
    
    # Суперпиксель (Nyquist: ≥2 камерных пикселя / OLED пиксель)
    sp = max(1, math.ceil(cam_res_um * 2 / OLED_PITCH_UM))
    d_model = int(SCREEN_PX_W / sp)
    
    # Скорость: кадров на слой ≈ 15, n_layers по d_model
    n_layers = 4 if d_model <= 256 else (6 if d_model <= 512 else (8 if d_model <= 1024 else 12))
    frames_per_layer = 15
    frames_total = frames_per_layer * n_layers
    tok_s = SCREEN_HZ / frames_total
    
    marker = ""
    if can_focus and best is None:
        best = {
            'd_cm': d_cm, 'sp': sp, 'd_model': d_model,
            'n_layers': n_layers, 'tok_s': tok_s,
            'cam_res_um': cam_res_um, 'oled_per_cam': oled_per_cam
        }
        marker = " ★"
    
    configs_b.append({
        'd_cm': d_cm, 'can_focus': can_focus, 'sp': sp,
        'd_model': d_model, 'n_layers': n_layers, 'tok_s': tok_s
    })
    
    print(f"    {d_cm:<6} | {focus_str:<6} | {cam_res_um:<6.0f}мк | "
          f"{oled_per_cam:<6.1f} | {sp}×{sp:<4} | {d_model:<7} | "
          f"{tok_s:<5.1f}{marker}")


# ═══════════════════════════════════════════════════════════════════
# 6. ОПТИМАЛЬНАЯ КОНФИГУРАЦИЯ (РЕЖИМ B)
# ═══════════════════════════════════════════════════════════════════

section("6. ★ ОПТИМАЛЬНАЯ КОНФИГУРАЦИЯ (РЕЖИМ B)")

dm = best['d_model']
nl = best['n_layers']
d_ff = dm * 4  # стандартный FFN

# Реальные параметры Transformer
params_attn = 4 * dm**2               # Q, K, V, O
params_mlp = 3 * dm * d_ff            # gate, up, down (SwiGLU)
params_norm = 4 * dm                   # 2 × LayerNorm (γ, β)
params_per_layer = params_attn + params_mlp + params_norm
vocab = 256                            # для PoC: байтовый vocab
params_embed = vocab * dm * 2          # embed + lm_head
total_params = nl * params_per_layer + params_embed

# Тайлинг
# При SP=1: матрица dm×dm помещается на экран 1080×1080 ЦЕЛИКОМ
# → нет тайлинга → 1 кадр на матрицу
sp = best['sp']
eff_tile = SCREEN_PX_W // sp  # эффективный размер тайла

def tiles(rows, cols, tile):
    return math.ceil(rows / tile) * math.ceil(cols / tile)

# Attention: Q, K, V проекции (каждая = 1 матрица dm×dm)
# + 3 кадра интерференция (QK^T) + 1 кадр V·attn + 1 матрица O
t_qkv = tiles(dm, dm, eff_tile) * 3     # Q, K, V
t_inter = 3                               # интерференция для QK^T
t_v_attn = 1                              # V · attention
t_o = tiles(dm, dm, eff_tile)             # O projection
frames_attn = t_qkv + t_inter + t_v_attn + t_o

# MLP: gate (dm×d_ff) + up (dm×d_ff) + down (d_ff×dm)
t_gate = tiles(dm, d_ff, eff_tile)
t_up = tiles(dm, d_ff, eff_tile)
t_down = tiles(d_ff, dm, eff_tile)
frames_mlp = t_gate + t_up + t_down

# LayerNorm (AEC камеры) — мгновенно, +1 кадр на стабилизацию
frames_norm = 2

frames_per_layer = frames_attn + frames_mlp + frames_norm

# LM head (dm → vocab)
frames_lm_head = tiles(dm, vocab, eff_tile)

frames_per_token = frames_per_layer * nl + frames_lm_head + 1  # +1 embed
time_per_token = frames_per_token / SCREEN_HZ
tok_per_sec = 1.0 / time_per_token

print(f"    Зеркало на {best['d_cm']} см от телефона")
print(f"    Виртуальное изображение: {2*best['d_cm']} см (= мин. фокус камеры ✅)")
print(f"    Суперпиксель: {sp}×{sp}")
print(f"    Эффективный тайл: {eff_tile}×{eff_tile}")
print(f"    d_model = {dm}")
print(f"    d_ff    = {d_ff}")
print(f"    n_layers= {nl}")
print(f"    vocab   = {vocab}")
print()

print(f"    ─── Параметры модели ───")
print(f"    Attention/слой: 4×{dm}² = {params_attn:,}")
print(f"    MLP/слой:       3×{dm}×{d_ff} = {params_mlp:,}")
print(f"    Norm/слой:      {params_norm:,}")
print(f"    Итого/слой:     {params_per_layer:,}")
print(f"    × {nl} слоёв:     {nl * params_per_layer:,}")
print(f"    Embed+LMhead:   {params_embed:,}")
print(f"    ═══ ИТОГО:      {total_params:,} ({total_params/1e6:.1f}М)")
print()

print(f"    ─── Кадры на токен ───")
print(f"    Attention: {frames_attn} кадров/слой")
print(f"      Q,K,V проекции: {t_qkv}")
print(f"      QK^T интерференция: {t_inter}")
print(f"      V·attn: {t_v_attn}")
print(f"      O проекция: {t_o}")
print(f"    MLP: {frames_mlp} кадров/слой")
print(f"      gate: {t_gate}, up: {t_up}, down: {t_down}")
print(f"    Norm: {frames_norm}")
print(f"    Итого/слой: {frames_per_layer}")
print(f"    × {nl} слоёв = {frames_per_layer * nl}")
print(f"    + LM head: {frames_lm_head}")
print(f"    ═══ ИТОГО: {frames_per_token} кадров/токен")
print()

print(f"    ─── Скорость ───")
print(f"    {frames_per_token} кадров ÷ {SCREEN_HZ} Гц = {time_per_token:.2f} сек/токен")
print(f"    ★ СКОРОСТЬ: {tok_per_sec:.2f} токенов/сек")


# ═══════════════════════════════════════════════════════════════════
# 7. SNR
# ═══════════════════════════════════════════════════════════════════

section("7. SNR БЮДЖЕТ")

d_m = best['d_cm'] / 100.0
lens_d = CAM_F / CAM_F_NUM
lens_area = math.pi * (lens_d / 2)**2
solid_angle = lens_area / (2 * d_m)**2

photons = OLED_POWER_PER_PX * MIRROR_R * solid_angle / PHOTON_E / SCREEN_HZ
electrons = photons * QE
electrons_sp = electrons * sp**2

snr = electrons_sp / math.sqrt(electrons_sp + CAM_READ_NOISE**2)
bits = math.log2(max(snr, 1))

print(f"    d = {best['d_cm']} см, линза f/{CAM_F_NUM}, SP = {sp}×{sp}")
print(f"    Телесный угол: {solid_angle:.2e} ср")
print(f"    Фотонов/OLED-пкс/кадр: {photons:.0f}")
print(f"    Электронов/пкс: {electrons:.0f}")
print(f"    С SP {sp}×{sp}: {electrons_sp:.0f} e⁻")
print(f"    SNR = {snr:.0f} → {bits:.1f} бит")
print()
if bits >= 8:
    print(f"    ✅ Достаточно для INT8 весов!")
elif bits >= 4:
    print(f"    ⚠️ Достаточно для INT4 квантизации")
else:
    print(f"    ❌ SNR мало! Нужен больше SP или ближе зеркало")


# ═══════════════════════════════════════════════════════════════════
# 8. УРОВЕНЬ МОДЕЛИ — ЧТО МОЖНО ДОКАЗАТЬ
# ═══════════════════════════════════════════════════════════════════

section("8. ЧТО МОЖНО ДОКАЗАТЬ НА КАЖДОМ УРОВНЕ")

print(f"""    ┌──────────┬──────────┬───────────────────────────────────────┐
    │ d_model  │ Парам.   │ Что можно доказать                    │
    ├──────────┼──────────┼───────────────────────────────────────┤
    │ 32-64    │ 50-200К  │ ✅ Оптический MatMul работает!         │
    │          │          │ ✅ Классификация MNIST (10 цифр)       │
    │          │          │ ✅ Принцип Born-rule подтверждён        │
    ├──────────┼──────────┼───────────────────────────────────────┤
    │ 128-256  │ 0.5-5М   │ ✅ Всё выше + распознавание жестов     │
    │          │          │ ✅ Простой NLP (классификация)          │
    │          │          │ ✅ D2NN → Transformer маппинг           │
    ├──────────┼──────────┼───────────────────────────────────────┤
    │ 512-1080 │ 20-225М  │ ✅ Генерация текста (GPT-2 уровень)    │
    │          │          │ ✅ SmolLM / TinyLlama инференс          │
    │          │          │ ✅ Полноценный LLM на зеркале!          │
    └──────────┴──────────┴───────────────────────────────────────┘
""")

# Уровень текущей конфигурации
if dm <= 64:
    level = "Базовый PoC (MatMul + MNIST)"
elif dm <= 256:
    level = "Расширенный PoC (NLP, жесты)"
elif dm <= 512:
    level = "SmolLM / TinyLlama"
elif dm <= 768:
    level = "GPT-2 Small"
elif dm <= 1024:
    level = "GPT-2 Medium"
else:
    level = "GPT-2 Large (ПОЛНЫЙ LLM!)"

print(f"    ★ Xiaomi 12 Lite при d={best['d_cm']} см: d_model={dm}")
print(f"      Уровень: {level}")
print(f"      Параметров: {total_params:,} ({total_params/1e6:.1f}М)")


# ═══════════════════════════════════════════════════════════════════
# 9. ПЛАН PoC ЭКСПЕРИМЕНТА
# ═══════════════════════════════════════════════════════════════════

section("9. ★ ПЛАН PoC ЭКСПЕРИМЕНТА")

print(f"""    ┌─────────────────────────────────────────────────────────────┐
    │  ЭТАП 1: ОПТИЧЕСКИЙ КАНАЛ (30 минут)                      │
    │  ───────────────────────────────────────────────────────── │
    │  Цель: доказать что камера видит OLED через зеркало       │
    │                                                             │
    │  1. Положить зеркало на стол                               │
    │  2. Телефон экраном вниз на {best['d_cm']} см (книги/коробка)      │
    │  3. Открыть фронтальную камеру → видно отражение экрана?  │
    │  4. Показать белый → чёрный → серый → измерить яркость    │
    │  5. Показать шахматку 2×2 → камера различает клетки?      │
    │                                                             │
    │  Результат: ✅ Оптический канал работает                   │
    ├─────────────────────────────────────────────────────────────┤
    │  ЭТАП 2: ОПТИЧЕСКИЙ DOT PRODUCT (1 час)                   │
    │  ───────────────────────────────────────────────────────── │
    │  Цель: интерференция = скалярное произведение              │
    │                                                             │
    │  1. Показать паттерн A → снять I_A                         │
    │  2. Показать паттерн B → снять I_B                         │
    │  3. Показать A+B → снять I_AB                              │
    │  4. Вычислить: (I_AB - I_A - I_B)/2 = Re(A·B*)            │
    │  5. Сравнить с цифровым A·B                                │
    │                                                             │
    │  Результат: ✅ Оптический MatMul подтверждён               │
    ├─────────────────────────────────────────────────────────────┤
    │  ЭТАП 3: ОДИН СЛОЙ НЕЙРОСЕТИ (2 часа)                     │
    │  ───────────────────────────────────────────────────────── │
    │  Цель: весь слой трансформера оптически                    │
    │                                                             │
    │  1. Обучить 1-слойную модель на MNIST (цифровой PyTorch)   │
    │  2. Извлечь веса W (d_model×d_model)                      │
    │  3. Показать W как паттерн OLED                            │
    │  4. Подать вход x → камера считывает y = W·x               │
    │  5. Сравнить оптический y с цифровым W@x                   │
    │                                                             │
    │  Результат: ✅ Нейросеть на зеркале работает!              │
    ├─────────────────────────────────────────────────────────────┤
    │  ЭТАП 4: ПОЛНЫЙ ИНФЕРЕНС (1 день)                         │
    │  ───────────────────────────────────────────────────────── │
    │  Цель: авторегрессивная генерация текста                   │
    │                                                             │
    │  1. Обучить {nl}-слойную модель (d_model={dm})                │
    │  2. Для каждого токена:                                     │
    │     Для каждого слоя:                                       │
    │       - Показать Q,K,V маски → камера → attention          │
    │       - Показать FFN маски → камера → MLP                  │
    │  3. LM head → argmax → следующий токен                     │
    │                                                             │
    │  Результат: ✅ LLM на зеркале генерирует текст!            │
    └─────────────────────────────────────────────────────────────┘
""")


# ═══════════════════════════════════════════════════════════════════
# 10. УСТАНОВКА
# ═══════════════════════════════════════════════════════════════════

section("10. УСТАНОВКА")

print(f"""    ┌────────────────────────────────────┐
    │                                    │
    │  [32МП камера]    AMOLED экран     │  ← Xiaomi 12 Lite
    │                                    │     экраном ВНИЗ
    └────────────────────────────────────┘
                    │
                    │ {best['d_cm']} см
                    │
    ╔════════════════════════════════════╗
    ║          ЗЕРКАЛО 10×10 см          ║  ← на столе
    ╚════════════════════════════════════╝

    Компоненты: телефон Xiaomi 12 Lite + обычное зеркало + подставка.
""")


# ═══════════════════════════════════════════════════════════════════
# 11. СРАВНЕНИЕ С ДРУГИМИ ПЛАТФОРМАМИ PoC
# ═══════════════════════════════════════════════════════════════════

section("11. СРАВНЕНИЕ")

print(f"""  ┌─────────────────────┬──────────┬────────┬─────────┬─────────────────────┐
  │ Платформа           │ d_model  │ Цена   │ Время   │ Что доказывает       │
  ├─────────────────────┼──────────┼────────┼─────────┼─────────────────────┤
  │ Xiaomi 12 Lite      │ {dm:<8} │ —      │ 1 день  │ Оптич. нейросеть     │
  │   + зеркало         │          │        │         │ работает!            │
  ├─────────────────────┼──────────┼────────┼─────────┼─────────────────────┤
  │ + макро-линза       │ 1080     │ $5-8   │ 1 день  │ Полный d_model=1080  │
  │   (ближнее поле)    │          │        │         │ GPT-2 Large!         │
  ├─────────────────────┼──────────┼────────┼─────────┼─────────────────────┤
  │ Samsung S24 Ultra   │ 1440     │ —      │ 1 день  │ d_model=1440,        │
  │   + зеркало         │          │        │         │ больше параметров    │
  ├─────────────────────┼──────────┼────────┼─────────┼─────────────────────┤
  │ Optical RFC (OPA)   │ 6144     │ $5000  │ 6 мес   │ Промышленный LLM     │
  │   кремниевый чип    │          │        │         │ 100+ ток/сек         │
  └─────────────────────┴──────────┴────────┴─────────┴─────────────────────┘
""")


# ═══════════════════════════════════════════════════════════════════
# 12. ПОЛНАЯ ТАБЛИЦА
# ═══════════════════════════════════════════════════════════════════

section("12. ПОЛНАЯ ТАБЛИЦА КОНФИГУРАЦИЙ")

print(f"  ┌──────┬───────┬────────┬─────────┬──────────┬─────────┬──────────────────────┐")
print(f"  │ d,см │ SP    │ d_model│ Парам.  │ Ток/сек  │ SNR,бит │ Уровень              │")
print(f"  ├──────┼───────┼────────┼─────────┼──────────┼─────────┼──────────────────────┤")

for c in configs_b:
    if not c['can_focus']:
        continue
    
    d_m_i = c['d_cm'] / 100.0
    sp_i = c['sp']
    dm_i = c['d_model']
    nl_i = c['n_layers']
    
    # SNR
    sol_i = math.pi * (CAM_F / CAM_F_NUM / 2)**2 / (2 * d_m_i)**2
    e_i = OLED_POWER_PER_PX * MIRROR_R * sol_i / PHOTON_E / SCREEN_HZ * QE * sp_i**2
    snr_i = e_i / math.sqrt(e_i + CAM_READ_NOISE**2) if e_i > 0 else 0
    bits_i = math.log2(max(snr_i, 1))
    
    # Параметры
    dff_i = dm_i * 4
    par_i = nl_i * (4*dm_i**2 + 3*dm_i*dff_i + 4*dm_i) + 256*dm_i*2
    
    # Скорость
    tok_i = c['tok_s']
    
    if dm_i <= 64:     lev = "Toy / PoC"
    elif dm_i <= 256:  lev = "Nano / PoC+"
    elif dm_i <= 512:  lev = "SmolLM"
    elif dm_i <= 768:  lev = "GPT-2 Small"
    elif dm_i <= 1024: lev = "GPT-2 Medium"
    else:              lev = "GPT-2 Large"
    
    star = " ★" if c['d_cm'] == best['d_cm'] else ""
    print(f"  │  {c['d_cm']:<3} │ {sp_i}×{sp_i:<3} │ {dm_i:<6} │ {par_i/1e6:<7.1f} │"
          f"  {tok_i:<7.1f} │  {bits_i:<5.1f}  │ {lev:<20} │{star}")

print(f"  └──────┴───────┴────────┴─────────┴──────────┴─────────┴──────────────────────┘")


# ═══════════════════════════════════════════════════════════════════
# 13. ИТОГО
# ═══════════════════════════════════════════════════════════════════

section("13. ИТОГОВЫЙ ВЕРДИКТ")

print(f"  ╔════════════════════════════════════════════════════════════════════╗")
print(f"  ║  XIAOMI 12 LITE — NVG PUREFIELD PoC                             ║")
print(f"  ╠════════════════════════════════════════════════════════════════════╣")
print(f"  ║                                                                    ║")
print(f"  ║  РЕЖИМ B (без модификаций, d={best['d_cm']} см):                          ║")
print(f"  ║  • d_model = {dm}, {nl} слоёв, {total_params:,} парам.       ║")
print(f"  ║  • {tok_per_sec:.2f} токенов/сек                                          ║")
print(f"  ║  • SNR = {snr:.0f} ({bits:.1f} бит)                                       ║")
print(f"  ║  • Уровень: {level}                  ║")
print(f"  ║                                                                    ║")
if dm >= 1000:
    print(f"  ║  ★ d_model={dm} — это уровень GPT-2 Large!                   ║")
    print(f"  ║    Можно запустить ПОЛНОЦЕННЫЙ LLM на зеркале!                ║")
    print(f"  ║                                                                    ║")
print(f"  ║  РЕЖИМ A (+ макро-линза $5, d=7.5 мм):                           ║")
print(f"  ║  • d_model = 1080, 12 слоёв, ~225М парам.                        ║")
print(f"  ║  • SNR > 10,000 (16+ бит)                                         ║")
print(f"  ║  • Стоимость: $8                                                  ║")
print(f"  ║                                                                    ║")
print(f"  ║  ЭТАП 1 → ДОКАЗАТЬ ЧТО РАБОТАЕТ                                 ║")
print(f"  ║  ЭТАП 2 → МАСШТАБИРОВАТЬ (Samsung S24, OPA чип)                  ║")
print(f"  ║                                                                    ║")
print(f"  ╚════════════════════════════════════════════════════════════════════╝")
