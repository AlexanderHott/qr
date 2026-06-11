import { createMemo, createSignal, Match, Switch } from "solid-js";
import { renderSVG } from "uqr";
import "./App.css";

type QrPreview =
  | { status: "empty" }
  | { status: "ready"; svg: string }
  | { status: "error"; message: string };

function App() {
  const [text, setText] = createSignal("");

  const qrPreview = createMemo<QrPreview>(() => {
    const value = text().trim();

    if (!value) {
      return { status: "empty" };
    }

    try {
      return {
        status: "ready",
        svg: renderSVG(value, {
          border: 4,
          ecc: "M",
          pixelSize: 8,
        }),
      };
    } catch {
      return {
        status: "error",
        message: "This text is too long to encode as a QR code.",
      };
    }
  });

  const readyPreview = createMemo(() => {
    const preview = qrPreview();
    return preview.status === "ready" ? preview : undefined;
  });

  const errorPreview = createMemo(() => {
    const preview = qrPreview();
    return preview.status === "error" ? preview : undefined;
  });

  return (
    <main class="app-shell">
      <h1 class="sr-only">QR Code Generator</h1>

      <section class="tool" aria-label="QR code generator">
        <form class="input-panel">
          <label class="field-label" for="qr-text">
            Text
          </label>
          <textarea
            id="qr-text"
            class="text-input"
            value={text()}
            placeholder="Paste text or a URL"
            spellcheck={false}
            onInput={(event) => setText(event.currentTarget.value)}
          />
        </form>

        <section class="preview-panel" aria-label="QR code preview">
          <div class="preview-surface" aria-live="polite">
            <Switch>
              <Match when={readyPreview()}>
                {(preview) => (
                  <div
                    class="qr-code"
                    role="img"
                    aria-label="Generated QR code"
                    innerHTML={preview().svg}
                  />
                )}
              </Match>
              <Match when={errorPreview()}>
                {(preview) => <p class="preview-message warning">{preview().message}</p>}
              </Match>
              <Match when={true}>
                <p class="preview-message">Enter text to preview</p>
              </Match>
            </Switch>
          </div>
        </section>
      </section>
    </main>
  );
}

export default App;
