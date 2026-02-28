---
description: "Arduino/ESP style: readability, maintainability, cleanness, and simplicity for sketches and embedded C++"
globs: ["*.ino", "*.cpp", "*.c"]
alwaysApply: false
---

# Arduino / ESP – Readability, Maintainability & Simplicity

Guidelines for clear, maintainable Arduino and ESP (AVR/ESP32/ESP8266) code. Focus on readability, clean structure, and simple approaches rather than deep C/C++ language details.

## Structure & Organization

- Keep `setup()` and `loop()` thin: delegate to named functions so intent is obvious at a glance.
- Group related logic into small, focused functions; one clear responsibility per function.
- Put constants, pin numbers, and config at the top of the file (or in a dedicated section) so behavior is easy to tune.
- Prefer a few well-named files over one huge sketch; split by concern (e.g. sensors, display, networking) when it helps readability.

## Naming & Clarity

- Use descriptive names: `ledPin`, `sensorValue`, `lastReadTime` instead of `p`, `v`, `t`.
- Name constants in UPPER_SNAKE_CASE; use them instead of magic numbers in the middle of code.
- Name functions by what they do: `readTemperature()`, `updateDisplay()`, `sendIfReady()`.
- Keep names consistent across the project (e.g. same style for pins, state, and timers).

## Simplicity of Approach

- Prefer the simplest approach that works: avoid extra abstractions and layers until you need them.
- Prefer non-blocking patterns over `delay()` in `loop()` so the sketch stays responsive and easier to reason about.
- Use `millis()` (or `micros()` when needed) for timing; keep state in a few clear variables (e.g. `lastActionTime`, `intervalMs`).
- Avoid deep nesting or long functions; use early returns and small helpers to keep control flow flat and readable.

## State & Data Flow

- Keep state explicit: use a small set of variables or a simple struct for “current state” rather than hidden globals scattered everywhere.
- Initialize state clearly in `setup()`; make it obvious what is updated in `loop()` and what is read-only.
- Prefer passing values (or simple structs) into functions over relying on many global variables; it makes dependencies and data flow obvious.

## Hardware & I/O

- Define pin numbers and roles once (constants or a small config block); avoid raw numbers in the middle of logic.
- Group pin setup in `setup()` and keep the order consistent (e.g. inputs, outputs, then peripherals).
- When using interrupts, keep the handler minimal: set a flag or update a single variable; do the real work in `loop()` so the code stays easy to read and debug.
- Document non-obvious hardware assumptions (e.g. pull-ups, active-low) in one place so future changes are safe.

## Libraries & Dependencies

- Use only the libraries you need; avoid “kitchen sink” includes to keep builds and behavior predictable.
- Prefer well-known, maintained libraries; add a short comment when the choice is non-obvious.
- Wrap third-party or tricky API calls in small, named functions so the rest of the sketch stays readable and easy to change.

## Platform Awareness (AVR vs ESP)

- Keep platform-specific code isolated (e.g. `#ifdef ESP32` blocks or small platform-specific functions) so the main logic stays clear.
- Be aware of limited RAM on AVR: avoid large buffers and heavy dynamic allocation in the main flow; keep structures and strings modest.
- On ESP, you can use more RAM and async/WiFi patterns, but still keep the overall structure simple and the same style (thin `loop()`, named functions, clear state).

## Debugging & Maintainability

- Use `Serial` (or equivalent) in a consistent way: e.g. one debug helper or macro so it’s easy to disable or reduce verbosity later.
- Add brief comments only where the “why” or “what” isn’t obvious from the code; avoid restating the code line-by-line.
- When something is fragile (timing, hardware quirk), document the constraint in one place so future edits don’t break it.

## Gotchas & Timesavers

- **Blocking in `loop()`**: Long `delay()` or blocking I/O makes behavior hard to follow and extend; prefer non-blocking state machines or timers.
- **Magic numbers**: Replace with named constants so tuning and debugging don’t require hunting through the code.
- **Pin and type confusion**: Use explicit types (e.g. `uint8_t` for pins) and named constants so pin roles are clear.
- **String usage on AVR**: Prefer fixed-size buffers or `F()` for literals where it keeps memory predictable and avoids fragmentation.
- **Interrupt handlers**: Do the minimum in the ISR; do the rest in `loop()` so logic stays in one place and is easier to maintain.
- **Copy-paste duplication**: Extract repeated patterns into a small function or a clear loop so fixes and changes happen in one place.

## Examples

### Good: Thin loop, named functions, clear state

```cpp
const uint8_t LED_PIN = LED_BUILTIN;
const unsigned long BLINK_INTERVAL_MS = 500;

unsigned long lastToggleTime = 0;
bool ledOn = false;

void setup() {
  pinMode(LED_PIN, OUTPUT);
}

void loop() {
  if (millis() - lastToggleTime >= BLINK_INTERVAL_MS) {
    lastToggleTime = millis();
    ledOn = !ledOn;
    digitalWrite(LED_PIN, ledOn ? HIGH : LOW);
  }
  // Other tasks can run here without blocking
}
```

### Good: Constants and one place for config

```cpp
namespace Config {
  const uint8_t SENSOR_PIN = A0;
  const unsigned long READ_INTERVAL_MS = 1000;
  const int MIN_VAL = 0;
  const int MAX_VAL = 1023;
}

void loop() {
  // Use Config::* so tuning is obvious and centralized
}
```

### Good: Interrupt does minimal work; logic in loop

```cpp
volatile bool buttonPressed = false;

void IRAM_ATTR onButton() {
  buttonPressed = true;  // Only set flag; handle in loop()
}

void loop() {
  if (buttonPressed) {
    buttonPressed = false;
    handleButtonAction();  // Clear, testable logic
  }
}
```

### Avoid: Blocking and magic numbers

```cpp
void loop() {
  digitalWrite(13, HIGH);
  delay(500);   // Blocks; hard to add other tasks
  digitalWrite(13, LOW);
  delay(500);   // Magic number; intent unclear
}
```
