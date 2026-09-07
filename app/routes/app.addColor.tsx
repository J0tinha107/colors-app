import { useState, useCallback, useRef, useEffect } from "react";
import { useFetcher } from "react-router";

export default function AddColorPage() {
  const fetcher = useFetcher<{ error?: string; success?: boolean }>();

  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [hex, setHex] = useState("");
  const [patternFile, setPatternFile] = useState<File | null>(null);
  const [patternPreview, setPatternPreview] = useState<string | undefined>();

  const fileInputRef = useRef<HTMLInputElement>(null);

  const hasHex = hex.trim().length > 0;
  const hasPattern = !!patternFile;

  const isSubmitting = fetcher.state !== "idle";
  const errorMessage = fetcher.data?.error;
  const successMessage = fetcher.data?.success
    ? "Color added successfully."
    : undefined;

  useEffect(() => {
    if (fetcher.data?.success) {
      setName("");
      setCode("");
      setHex("");
      setPatternFile(null);
      setPatternPreview(undefined);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }, [fetcher.data]);

  useEffect(() => {
    return () => {
      if (patternPreview) URL.revokeObjectURL(patternPreview);
    };
  }, [patternPreview]);

  const handleHexChange = useCallback((value: string) => {
    setHex(value);
    if (value.trim().length > 0) {
      setPatternFile(null);
      setPatternPreview(undefined);
    }
  }, []);

  const handleRemoveHex = useCallback(() => {
    setHex("");
  }, []);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      setPatternFile(file);
      setPatternPreview(URL.createObjectURL(file));
      setHex("");
    },
    [],
  );

  const handleRemoveFile = useCallback(() => {
    setPatternFile(null);
    setPatternPreview(undefined);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  const handleSubmit = useCallback(() => {
    const formData = new FormData();

    formData.append("actionType", "ADD");
    formData.append("name", name.trim());
    formData.append("code", code.trim());
    if (hasHex) formData.append("hex", hex.trim());
    if (hasPattern && patternFile) formData.append("pattern", patternFile);

    fetcher.submit(formData, {
      action: "/api/color",
      method: "post",
      encType: "multipart/form-data",
    });
  }, [name, code, hex, hasHex, hasPattern, patternFile, fetcher]);

  const previewStyle: React.CSSProperties = hasPattern
    ? {
        backgroundImage: `url(${patternPreview})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }
    : hasHex
      ? { background: hex }
      : {
          background:
            "repeating-linear-gradient(45deg, #f1f1f1, #f1f1f1 6px, #fafafa 6px, #fafafa 12px)",
        };

  const canSubmit = !!name.trim() && !!code.trim() && (hasHex || hasPattern);

  return (
    <s-page>
      <s-box background="subdued" minBlockSize="100px" padding="large-500">
        <div style={{ margin: "0 auto", maxWidth: 640 }}>
          <s-stack direction="block" gap="large-400">
            <div style={{ textAlign: "center" }}>
              <s-text>Add Color</s-text>
            </div>

            {errorMessage && (
              <s-banner heading={errorMessage} tone="critical" />
            )}
            {successMessage && (
              <s-banner heading={successMessage} tone="success" />
            )}

            <s-box background="base" borderRadius="base" padding="large-300">
              <s-stack direction="inline" gap="large-400" alignItems="center">
                <div
                  style={{
                    width: 64,
                    height: 64,
                    borderRadius: 12,
                    flexShrink: 0,
                    ...previewStyle,
                  }}
                />

                <s-stack direction="block" gap="small-100">
                  <s-text>{name || "New Color"}</s-text>
                  <s-text tone="neutral">{code || "Without code"}</s-text>
                </s-stack>
              </s-stack>
            </s-box>

            <s-stack direction="block" gap="large-400">
              <s-text-field
                label="Name"
                placeholder="e.g. Blue"
                value={name}
                onChange={(event) =>
                  setName((event.target as HTMLInputElement).value)
                }
                required
              />

              <s-text-field
                label="Code"
                placeholder="e.g. N01"
                value={code}
                onChange={(event) =>
                  setCode((event.target as HTMLInputElement).value)
                }
                required
              />

              <s-stack direction="block" gap="small-200">
                <s-text-field
                  label="Hexadecimal Color"
                  placeholder="#000000"
                  value={hex}
                  onChange={(event) =>
                    handleHexChange((event.target as HTMLInputElement).value)
                  }
                  disabled={hasPattern}
                />
                <s-stack direction="inline" gap="large-100" alignItems="center">
                  <input
                    type="color"
                    value={hex || "#000000"}
                    onChange={(e) => handleHexChange(e.target.value)}
                    disabled={hasPattern}
                    style={{
                      width: 40,
                      height: 40,
                      border: "1px solid #ccc",
                      borderRadius: 8,
                      padding: 2,
                      cursor: hasPattern ? "not-allowed" : "pointer",
                    }}
                  />
                  {hasHex && (
                    <s-button
                      variant="tertiary"
                      tone="critical"
                      onClick={handleRemoveHex}
                    >
                      Remove
                    </s-button>
                  )}
                </s-stack>
              </s-stack>

              <s-box>
                <s-box paddingBlockEnd="small-100">
                  <s-text>Pattern Image</s-text>
                </s-box>

                {patternPreview ? (
                  <s-stack
                    direction="inline"
                    gap="large-300"
                    alignItems="center"
                  >
                    <div
                      style={{
                        width: 48,
                        height: 48,
                        borderRadius: 8,
                        overflow: "hidden",
                        flexShrink: 0,
                        backgroundImage: `url(${patternPreview})`,
                        backgroundSize: "cover",
                        backgroundPosition: "center",
                        border: "1px solid #ccc",
                      }}
                    />

                    <s-text tone="neutral">{patternFile?.name}</s-text>

                    <s-button
                      variant="tertiary"
                      tone="critical"
                      onClick={handleRemoveFile}
                    >
                      Remove
                    </s-button>
                  </s-stack>
                ) : (
                  <label
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      border: "1px solid #ccc",
                      borderRadius: 8,
                      padding: "12px 14px",
                      cursor: hasHex ? "not-allowed" : "pointer",
                      background: hasHex ? "#f1f1f1" : "#fff",
                      opacity: hasHex ? 0.6 : 1,
                    }}
                  >
                    <s-icon type="image" tone="neutral" />
                    <s-text tone="neutral">Choose file - no file chosen</s-text>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleFileChange}
                      disabled={hasHex}
                      style={{ display: "none" }}
                    />
                  </label>
                )}
              </s-box>

              <s-button
                variant="primary"
                disabled={!canSubmit || isSubmitting}
                loading={isSubmitting}
                onClick={handleSubmit}
              >
                {isSubmitting ? "Saving..." : "Save Color"}
              </s-button>
            </s-stack>
          </s-stack>
        </div>
      </s-box>
    </s-page>
  );
}
