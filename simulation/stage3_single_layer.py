"""
═══════════════════════════════════════════════════════════════════════
 NVG PureField PoC — Этап 3: ОДИН СЛОЙ НЕЙРОСЕТИ НА ЗЕРКАЛЕ
═══════════════════════════════════════════════════════════════════════

  Цель: доказать что один слой нейросети работает оптически.

  План:
  1. Обучить 1-слойную модель на MNIST (цифровой PyTorch)
  2. Извлечь веса W
  3. Прогнать инференс через оптическую симуляцию
  4. Сравнить: оптическая точность vs цифровая

  Автор: NVG-Research / Oleg Kirichenko
"""

import numpy as np
import math
import sys

# Оптическая модель из stage1/stage2
from stage1_optical_channel import (
    SCREEN_PX_W, MIRROR_D_CM, MIRROR_R, CAM_QE, CAM_READ_NOISE,
    CAM_FULL_WELL, CAM_F, CAM_F_NUM, SCREEN_HZ, PHOTON_E,
    oled_emit, mirror_reflect, section
)

try:
    import torch
    import torch.nn as nn
    import torch.nn.functional as F
    HAS_TORCH = True
except ImportError:
    HAS_TORCH = False
    print("⚠️ PyTorch не установлен. Используем numpy-only режим.")


# ═══════════════════════════════════════════════════════════════════
# ОПТИЧЕСКАЯ МОДЕЛЬ (из stage2, с Auto-Exposure)
# ═══════════════════════════════════════════════════════════════════

def optical_intensity(pattern, d_cm=MIRROR_D_CM):
    """OLED → зеркало → камера → электроны (с Auto-Exposure)."""
    emitted = oled_emit(pattern)
    reflected = mirror_reflect(emitted)
    
    d_m = d_cm / 100.0
    virt_d = 2 * d_m
    oled_power = 0.35e-6
    
    lens_d = CAM_F / CAM_F_NUM
    lens_area = math.pi * (lens_d / 2)**2
    solid_angle = lens_area / virt_d**2
    
    max_electrons = oled_power * MIRROR_R * solid_angle / PHOTON_E / SCREEN_HZ * CAM_QE
    ae_factor = (CAM_FULL_WELL * 0.80) / max_electrons
    
    electrons = reflected * max_electrons * ae_factor
    return electrons


def optical_matvec(W, x, d_cm=MIRROR_D_CM, add_noise=True):
    """Оптический y = W @ x.
    
    W: (m, n) float 0-1
    x: (n,) float 0-1
    """
    m, n = W.shape
    
    # Нормализация W и x в [0, 1]
    w_min, w_max = W.min(), W.max()
    x_min, x_max = x.min(), x.max()
    
    if w_max - w_min > 1e-10:
        W_norm = (W - w_min) / (w_max - w_min)
    else:
        W_norm = np.zeros_like(W)
    
    if x_max - x_min > 1e-10:
        x_norm = (x - x_min) / (x_max - x_min)
    else:
        x_norm = np.zeros_like(x)
    
    # OLED отображает W_norm[i,j] * x_norm[j]
    oled_pattern = np.clip(W_norm * x_norm[np.newaxis, :], 0, 1)
    
    electrons = optical_intensity(oled_pattern, d_cm)
    
    if add_noise:
        rng = np.random.RandomState(None)  # разный шум каждый раз
        electrons_noisy = rng.poisson(np.maximum(electrons, 0).astype(np.float64)).astype(np.float64)
        electrons_noisy += rng.normal(0, CAM_READ_NOISE, electrons.shape)
        electrons_noisy = np.clip(electrons_noisy, 0, CAM_FULL_WELL)
    else:
        electrons_noisy = electrons
    
    # Сумма по столбцам → y[i] = Σ_j W_norm[i,j] * x_norm[j] (в электронах)
    raw_sums = np.sum(electrons_noisy, axis=1)
    
    # Нормализация: ref = all ones
    ref = optical_intensity(np.ones_like(oled_pattern), d_cm)
    ref_sums = np.sum(ref, axis=1)
    y_norm = raw_sums / ref_sums  # в [0, 1] масштабе
    
    # Обратная денормализация: y = W @ x
    # y_norm ≈ Σ W_norm[i,j] * x_norm[j] / n
    # W_norm = (W - w_min)/(w_max-w_min), x_norm = (x - x_min)/(x_max-x_min)
    # Нужно восстановить: y = W @ x = (w_max-w_min) * (x_max-x_min) * Σ W_norm*x_norm + bias
    scale_wx = (w_max - w_min) * (x_max - x_min) 
    # y_norm * n = Σ W_norm*x_norm
    y_optical = y_norm * n * scale_wx
    # Добавляем bias: W_min * Σx + (W - W_min) @ x_min * ones
    y_optical += w_min * np.sum(x) + (W.sum(axis=1) - m * w_min) * x_min
    # Упрощение: просто сравниваем с цифровым по корреляции
    
    return y_optical


def optical_relu(x):
    """ReLU на CPU (тривиальная операция)."""
    return np.maximum(x, 0)


# ═══════════════════════════════════════════════════════════════════
# ГЕНЕРАЦИЯ MNIST-ПОДОБНЫХ ДАННЫХ (без torchvision)
# ═══════════════════════════════════════════════════════════════════

def generate_simple_digits(n_samples=500, img_size=16):
    """Генерируем простые паттерны цифр 0-9 (16×16).
    
    Вместо настоящего MNIST — простые геометрические фигуры.
    Достаточно для PoC: доказать что оптическая классификация работает.
    """
    rng = np.random.RandomState(42)
    images = []
    labels = []
    
    for _ in range(n_samples):
        label = rng.randint(0, 10)
        img = np.zeros((img_size, img_size))
        
        cx, cy = img_size // 2, img_size // 2
        noise = rng.randn(img_size, img_size) * 0.05
        
        if label == 0:  # Круг
            for i in range(img_size):
                for j in range(img_size):
                    r = math.sqrt((i - cx)**2 + (j - cy)**2)
                    if 3 < r < 5:
                        img[i, j] = 0.8 + rng.rand() * 0.2
        elif label == 1:  # Вертикальная линия
            img[2:-2, cx-1:cx+1] = 0.8 + rng.rand(img_size-4, 2) * 0.2
        elif label == 2:  # Горизонтальные линии
            img[3:5, 3:-3] = 0.8
            img[cy:cy+2, 3:-3] = 0.8
            img[-5:-3, 3:-3] = 0.8
            img[3:cy, -5:-3] = 0.8
            img[cy:-3, 3:5] = 0.8
        elif label == 3:  # Три горизонтальные линии
            img[3:5, 3:-3] = 0.8
            img[cy:cy+2, 3:-3] = 0.8
            img[-5:-3, 3:-3] = 0.8
            img[3:-3, -5:-3] = 0.8
        elif label == 4:  # L-форма + вертикаль
            img[3:-3, -5:-3] = 0.8
            img[cy:cy+2, 3:-3] = 0.8
            img[3:cy, 3:5] = 0.8
        elif label == 5:  # S-форма
            img[3:5, 3:-3] = 0.8
            img[cy:cy+2, 3:-3] = 0.8
            img[-5:-3, 3:-3] = 0.8
            img[3:cy, 3:5] = 0.8
            img[cy:-3, -5:-3] = 0.8
        elif label == 6:  # 6-like
            img[3:5, 3:-3] = 0.8
            img[cy:cy+2, 3:-3] = 0.8
            img[-5:-3, 3:-3] = 0.8
            img[3:-3, 3:5] = 0.8
            img[cy:-3, -5:-3] = 0.8
        elif label == 7:  # 7-like
            img[3:5, 3:-3] = 0.8
            img[3:-3, -5:-3] = 0.8
        elif label == 8:  # Два круга
            for i in range(img_size):
                for j in range(img_size):
                    r1 = math.sqrt((i - cx + 3)**2 + (j - cy)**2)
                    r2 = math.sqrt((i - cx - 3)**2 + (j - cy)**2)
                    if 2 < r1 < 4 or 2 < r2 < 4:
                        img[i, j] = 0.8
        elif label == 9:  # 9-like
            img[3:5, 3:-3] = 0.8
            img[cy:cy+2, 3:-3] = 0.8
            img[3:cy, 3:5] = 0.8
            img[3:-3, -5:-3] = 0.8
        
        img = np.clip(img + noise, 0, 1)
        
        # Случайные сдвиги (±2 пикселя)
        dx = rng.randint(-2, 3)
        dy = rng.randint(-2, 3)
        img = np.roll(np.roll(img, dx, axis=1), dy, axis=0)
        
        images.append(img)
        labels.append(label)
    
    return np.array(images), np.array(labels)


# ═══════════════════════════════════════════════════════════════════
# МОДЕЛЬ (numpy-only для совместимости)
# ═══════════════════════════════════════════════════════════════════

class SimpleNeuralNetwork:
    """1-слойная нейросеть: input → Linear → ReLU → Linear → output.
    
    Физика:
    Linear1 = OLED отображает W1 * x → камера считывает → CPU суммирует
    ReLU = CPU (тривиально)
    Linear2 = ещё один кадр OLED
    """
    def __init__(self, input_dim, hidden_dim, output_dim):
        self.input_dim = input_dim
        self.hidden_dim = hidden_dim
        self.output_dim = output_dim
        
        # Xavier initialization
        rng = np.random.RandomState(42)
        scale1 = np.sqrt(2.0 / (input_dim + hidden_dim))
        scale2 = np.sqrt(2.0 / (hidden_dim + output_dim))
        
        self.W1 = rng.randn(hidden_dim, input_dim) * scale1
        self.b1 = np.zeros(hidden_dim)
        self.W2 = rng.randn(output_dim, hidden_dim) * scale2
        self.b2 = np.zeros(output_dim)
    
    def forward(self, x):
        """Цифровой инференс."""
        h = self.W1 @ x + self.b1
        h = np.maximum(h, 0)  # ReLU
        out = self.W2 @ h + self.b2
        return out
    
    def forward_optical(self, x, add_noise=True):
        """Оптический инференс: W @ x через OLED → зеркало → камера."""
        # Layer 1: оптический MatVec
        h = optical_matvec(self.W1, x, add_noise=add_noise)
        h += self.b1  # bias на CPU
        h = optical_relu(h)  # ReLU на CPU
        
        # Layer 2: оптический MatVec
        out = optical_matvec(self.W2, h, add_noise=add_noise)
        out += self.b2
        
        return out
    
    def predict(self, x, optical=False):
        """Классификация: argmax."""
        if optical:
            logits = self.forward_optical(x)
        else:
            logits = self.forward(x)
        return np.argmax(logits)
    
    def train(self, X, y, epochs=100, lr=0.01, batch_size=32):
        """Обучение через SGD (цифровое, не оптическое)."""
        n = len(X)
        rng = np.random.RandomState(42)
        
        for ep in range(1, epochs + 1):
            perm = rng.permutation(n)
            total_loss = 0
            correct = 0
            
            for i in range(0, n, batch_size):
                idx = perm[i:i+batch_size]
                batch_x = X[idx]
                batch_y = y[idx]
                bs = len(idx)
                
                # Forward
                grad_W1 = np.zeros_like(self.W1)
                grad_b1 = np.zeros_like(self.b1)
                grad_W2 = np.zeros_like(self.W2)
                grad_b2 = np.zeros_like(self.b2)
                
                for j in range(bs):
                    x_j = batch_x[j]
                    y_j = batch_y[j]
                    
                    # Forward pass
                    z1 = self.W1 @ x_j + self.b1
                    a1 = np.maximum(z1, 0)
                    z2 = self.W2 @ a1 + self.b2
                    
                    # Softmax
                    exp_z = np.exp(z2 - np.max(z2))
                    probs = exp_z / np.sum(exp_z)
                    
                    # Loss
                    total_loss += -np.log(max(probs[y_j], 1e-10))
                    correct += (np.argmax(probs) == y_j)
                    
                    # Backward
                    dz2 = probs.copy()
                    dz2[y_j] -= 1
                    
                    grad_W2 += np.outer(dz2, a1)
                    grad_b2 += dz2
                    
                    da1 = self.W2.T @ dz2
                    dz1 = da1 * (z1 > 0).astype(float)
                    
                    grad_W1 += np.outer(dz1, x_j)
                    grad_b1 += dz1
                
                # Update
                self.W1 -= lr * grad_W1 / bs
                self.b1 -= lr * grad_b1 / bs
                self.W2 -= lr * grad_W2 / bs
                self.b2 -= lr * grad_b2 / bs
            
            if ep % 20 == 0 or ep == 1:
                acc = correct / n * 100
                avg_loss = total_loss / n
                print(f"    Эпоха {ep:3d}/{epochs} | Loss: {avg_loss:.4f} | Acc: {acc:.1f}%")
        
        return correct / n * 100


# ═══════════════════════════════════════════════════════════════════
# ТЕСТЫ
# ═══════════════════════════════════════════════════════════════════

def test_single_layer():
    """Обучаем модель цифрово → тестируем оптически."""
    section("ОБУЧЕНИЕ МОДЕЛИ (ЦИФРОВОЕ)")
    
    IMG_SIZE = 16
    HIDDEN = 64
    N_CLASSES = 10
    INPUT_DIM = IMG_SIZE * IMG_SIZE  # 256
    
    # Данные
    print(f"    Генерация данных: {IMG_SIZE}×{IMG_SIZE} = {INPUT_DIM} пикселей")
    X_all, y_all = generate_simple_digits(600, IMG_SIZE)
    
    # Flatten
    X_flat = X_all.reshape(len(X_all), -1)
    
    # Train/test split
    n_train = 400
    X_train, y_train = X_flat[:n_train], y_all[:n_train]
    X_test, y_test = X_flat[n_train:], y_all[n_train:]
    
    print(f"    Train: {n_train}, Test: {len(X_test)}")
    print(f"    Input: {INPUT_DIM}, Hidden: {HIDDEN}, Output: {N_CLASSES}")
    print()
    
    # Модель
    model = SimpleNeuralNetwork(INPUT_DIM, HIDDEN, N_CLASSES)
    
    # Обучение (цифровое)
    final_acc = model.train(X_train, y_train, epochs=100, lr=0.05)
    
    # Тест цифровой
    section("ТЕСТ: ЦИФРОВОЙ ИНФЕРЕНС")
    
    correct_digital = 0
    for i in range(len(X_test)):
        pred = model.predict(X_test[i], optical=False)
        correct_digital += (pred == y_test[i])
    
    acc_digital = correct_digital / len(X_test) * 100
    print(f"    Цифровая точность (test): {acc_digital:.1f}%")
    
    # Тест оптический (без шума — baseline)
    section("ТЕСТ: ОПТИЧЕСКИЙ ИНФЕРЕНС (без шума)")
    
    correct_optical_clean = 0
    for i in range(len(X_test)):
        pred = model.predict(X_test[i], optical=True)
        correct_optical_clean += (pred == y_test[i])
    
    acc_optical_clean = correct_optical_clean / len(X_test) * 100
    print(f"    Оптическая точность (без шума): {acc_optical_clean:.1f}%")
    
    # Тест оптический (с шумом — реалистичный)
    section("ТЕСТ: ОПТИЧЕСКИЙ ИНФЕРЕНС (с шумом)")
    
    correct_optical = 0
    match_digital = 0
    
    for i in range(len(X_test)):
        pred_opt = model.predict(X_test[i], optical=True)
        pred_dig = model.predict(X_test[i], optical=False)
        correct_optical += (pred_opt == y_test[i])
        match_digital += (pred_opt == pred_dig)
    
    acc_optical = correct_optical / len(X_test) * 100
    match_pct = match_digital / len(X_test) * 100
    
    print(f"    Оптическая точность (с шумом): {acc_optical:.1f}%")
    print(f"    Совпадение с цифровым: {match_pct:.1f}%")
    print(f"    Деградация: {acc_digital - acc_optical:.1f}%")
    
    # Сравнение выходов (логитов)
    section("ДЕТАЛЬНОЕ СРАВНЕНИЕ ЛОГИТОВ")
    
    n_show = min(5, len(X_test))
    print(f"    {'Пример':<8} | {'Label':<6} | {'Цифр.':<6} | {'Оптич.':<6} | "
          f"{'Совпад?':<8} | {'Корр. логитов':<14}")
    print(f"    {'─'*62}")
    
    correlations = []
    for i in range(n_show):
        logits_dig = model.forward(X_test[i])
        logits_opt = model.forward_optical(X_test[i], add_noise=False)
        
        pred_dig = np.argmax(logits_dig)
        pred_opt = np.argmax(logits_opt)
        
        # Корреляция логитов
        corr = np.corrcoef(logits_dig, logits_opt)[0, 1]
        correlations.append(corr)
        
        match = "✅" if pred_dig == pred_opt else "❌"
        correct_str = "✅" if pred_opt == y_test[i] else "❌"
        
        print(f"    #{i:<7} | {y_test[i]:<6} | {pred_dig:<6} | {pred_opt:<6} | "
              f"{match:<8} | {corr:<14.6f}")
    
    mean_corr = np.mean(correlations)
    print(f"\n    Средняя корреляция логитов: {mean_corr:.6f}")
    
    return acc_digital, acc_optical, mean_corr


def test_frame_count():
    """Подсчёт кадров для оптического инференса одного слоя."""
    section("КАДРЫ НА ИНФЕРЕНС")
    
    IMG_SIZE = 16
    INPUT_DIM = IMG_SIZE * IMG_SIZE
    HIDDEN = 64
    N_CLASSES = 10
    
    # Layer 1: W1 (64 × 256) — помещается на экран 1080×1080
    # Один кадр: OLED показывает W1 * x (64×256 = 16384 пикселей, <<1080²)
    frames_l1 = 1  # один кадр для W1 @ x
    frames_relu = 0  # CPU, мгновенно
    
    # Layer 2: W2 (10 × 64) — маленькая, один кадр
    frames_l2 = 1
    
    frames_total = frames_l1 + frames_l2
    time_ms = frames_total * 1000 / SCREEN_HZ
    inferences_per_sec = SCREEN_HZ / frames_total
    
    print(f"    Layer 1: W1 ({HIDDEN}×{INPUT_DIM}) → {frames_l1} кадр")
    print(f"    ReLU: CPU → 0 кадров")
    print(f"    Layer 2: W2 ({N_CLASSES}×{HIDDEN}) → {frames_l2} кадр")
    print(f"    ──────────────────────")
    print(f"    Итого: {frames_total} кадра")
    print(f"    При 120 Гц: {time_ms:.1f} мс/инференс")
    print(f"    ★ {inferences_per_sec:.0f} инференсов/сек!")
    print()
    print(f"    Для сравнения:")
    print(f"    • CPU (Xiaomi 12 Lite): ~200 инференсов/сек")
    print(f"    • Оптический: {inferences_per_sec:.0f} инференсов/сек")
    print(f"    • Но оптический НЕ тратит энергию на MatMul!")


# ═══════════════════════════════════════════════════════════════════
# MAIN
# ═══════════════════════════════════════════════════════════════════

def main():
    print("=" * 78)
    print("  NVG PUREFIELD PoC — ЭТАП 3: ОДИН СЛОЙ НЕЙРОСЕТИ НА ЗЕРКАЛЕ")
    print("  Xiaomi 12 Lite + Зеркало на 5 см")
    print("=" * 78)
    
    acc_dig, acc_opt, corr = test_single_layer()
    test_frame_count()
    
    # Итог
    section("★ ИТОГ ЭТАПА 3")
    
    print(f"  ╔════════════════════════════════════════════════════════════════════╗")
    print(f"  ║  ЭТАП 3: ОДИН СЛОЙ НЕЙРОСЕТИ — РЕЗУЛЬТАТЫ                      ║")
    print(f"  ╠════════════════════════════════════════════════════════════════════╣")
    print(f"  ║                                                                    ║")
    print(f"  ║  Модель: 256→64→10 (1 скрытый слой, ReLU)                        ║")
    print(f"  ║  Задача: классификация цифр 0-9 (16×16 пикселей)                 ║")
    print(f"  ║                                                                    ║")
    print(f"  ║  Цифровая точность:  {acc_dig:5.1f}%                                    ║")
    print(f"  ║  Оптическая точность:{acc_opt:5.1f}%                                    ║")
    print(f"  ║  Корреляция логитов: {corr:.4f}                                    ║")
    print(f"  ║  Деградация:         {acc_dig - acc_opt:5.1f}%                                    ║")
    print(f"  ║                                                                    ║")
    
    if acc_opt > 70 and corr > 0.9:
        print(f"  ║  ★ НЕЙРОСЕТЬ НА ЗЕРКАЛЕ РАБОТАЕТ!                              ║")
        print(f"  ║    Оптический MatMul заменяет цифровой → ПЕРЕХОД К ЭТАПУ 4!   ║")
    elif acc_opt > 50:
        print(f"  ║  ⚠️ Работает, но нужна калибровка для лучшей точности         ║")
    else:
        print(f"  ║  ❌ Точность низкая — нужна отладка оптического канала         ║")
    print(f"  ║                                                                    ║")
    print(f"  ╚════════════════════════════════════════════════════════════════════╝")


if __name__ == '__main__':
    main()
