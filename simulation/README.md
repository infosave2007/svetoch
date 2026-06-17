🇷🇺 Ниже после английского текста.

# Pure‑software validation

These scripts reproduce the core optical‑computing results in NumPy — no phone, mirror, or camera required. They model the screen→mirror→camera channel and verify the math end‑to‑end, which is useful for understanding the physics and for continuous integration.

```bash
pip install numpy   # see ../requirements.txt
```

| Script | What it validates |
|--------|-------------------|
| `xiaomi_12lite_llm_calc.py` | Full parameter budget for the reference device: pixel pitch, Talbot distance, d_model, parameter count, throughput, SNR. |
| `stage1_optical_channel.py` | The optical channel: linearity, stripe contrast (MTF), SNR in bits, effective `d_model`. |
| `stage2_dot_product.py` | The optical dot product and MatVec correlation, including 3‑frame interferometry. |
| `stage3_single_layer.py` | One neural layer (256→64→10) computed digitally vs. optically; reports the accuracy gap. |
| `stage4_full_inference.py` | A 2‑layer transformer doing autoregressive text generation through the optical channel. |

Run any script directly:

```bash
python stage1_optical_channel.py
python stage4_full_inference.py
```

These are simulations of the same primitives the on‑device experiments in [`../app/stages/`](../app/stages/) measure for real. The hardware run is the ground truth; these scripts are the model it is compared against.

---

# Программная валидация

Эти скрипты воспроизводят ключевые результаты оптического вычисления на NumPy — без телефона, зеркала и камеры. Они моделируют канал «экран → зеркало → камера» и проверяют математику от начала до конца, что полезно для понимания физики и для CI.

```bash
pip install numpy   # см. ../requirements.txt
```

| Скрипт | Что проверяет |
|--------|---------------|
| `xiaomi_12lite_llm_calc.py` | Полный бюджет параметров эталонного устройства: pixel pitch, дистанция Тальбота, d_model, число параметров, пропускную способность, SNR. |
| `stage1_optical_channel.py` | Оптический канал: линейность, контраст полос (MTF), SNR в битах, эффективный `d_model`. |
| `stage2_dot_product.py` | Оптическое скалярное произведение и корреляцию MatVec, включая 3‑кадровую интерферометрию. |
| `stage3_single_layer.py` | Один слой нейросети (256→64→10), вычисленный цифрой и оптикой; показывает разрыв в точности. |
| `stage4_full_inference.py` | 2‑слойный трансформер с авторегрессивной генерацией текста через оптический канал. |

Запуск любого скрипта напрямую:

```bash
python stage1_optical_channel.py
python stage4_full_inference.py
```

Это симуляции тех же примитивов, которые эксперименты на устройстве в [`../app/stages/`](../app/stages/) измеряют по‑настоящему. Аппаратный прогон — эталон истины; эти скрипты — модель, с которой он сравнивается.
