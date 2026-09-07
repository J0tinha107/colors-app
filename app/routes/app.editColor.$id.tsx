import { useState, useCallback, useEffect } from "react";
import { useLoaderData, useFetcher, useNavigate } from "react-router";
import { authenticate } from "../shopify.server";
import { getColorMetaobjectById } from "./controller/api.Color";
import type { LoaderFunctionArgs } from "react-router";

export async function loader({ request, params }: LoaderFunctionArgs) {
  const { admin } = await authenticate.admin(request);
  const color = await getColorMetaobjectById(admin, params.id!);
  if (!color) throw new Response("Color not found", { status: 404 });
  return { color };
}

export default function EditColorPage() {
  const { color } = useLoaderData<typeof loader>();
  const fetcher = useFetcher<{ error?: string; success?: boolean }>();
  const navigate = useNavigate();

  const [name, setName] = useState(color.name ?? "");
  const [code, setCode] = useState(color.code ?? "");
  const [hex, setHex] = useState(color.swatchColor ?? "");
  const [patternFile, setPatternFile] = useState<File | null>(null);
  const [patternPreview, setPatternPreview] = useState<string | undefined>(
    color.patternUrl,
  );

  const hasHex = hex.trim().length > 0;
  const hasPattern = !!(patternFile || patternPreview);
  const isSubmitting = fetcher.state !== "idle";
  const errorMessage = fetcher.data?.error;
  const successMessage = fetcher.data?.success
    ? "Color saved successfully."
    : undefined;
  const canSubmit = !!name.trim() && !!code.trim() && (hasHex || hasPattern);

  useEffect(() => {
    return () => {
      if (patternPreview && patternFile) URL.revokeObjectURL(patternPreview);
    };
  }, [patternPreview, patternFile]);

  const handleHexChange = useCallback((value: string) => {
    setHex(value);
    if (value.trim().length > 0) {
      setPatternFile(null);
      setPatternPreview(undefined);
    }
  }, []);

  const handleRemoveHex = useCallback(() => setHex(""), []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    if (!file) return;
    setPatternFile(file);
    setPatternPreview(URL.createObjectURL(file));
    setHex("");
  };

  const handleRemovePattern = () => {
    setPatternFile(null);
    setPatternPreview(undefined);
  };

  const handleSubmit = () => {
    const formData = new FormData();
    formData.append("actionType", "EDIT");
    formData.append("id", color.id);
    formData.append("name", name.trim());
    formData.append("code", code.trim());
    formData.append("hex", hasHex ? hex.trim() : "");

    if (patternFile) {
      formData.append("pattern", patternFile);
    } else if (!patternPreview) {
      formData.append("removePattern", "true");
    }

    fetcher.submit(formData, {
      action: "/api/color",
      method: "post",
      encType: "multipart/form-data",
    });
  };

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

  return (
    <s-page
      heading={`Edit ${color.name || "color"}`}
      backAction={{ target: "/app" }}
    >
      <s-button
        slot="primary-action"
        variant="primary"
        disabled={!canSubmit || isSubmitting}
        loading={isSubmitting}
        onClick={handleSubmit}
      >
        Save changes
      </s-button>

      <s-box padding="large-500">
        <div style={{ margin: "0 auto", maxWidth: 640 }}>
          <s-stack direction="block" gap="large-400">
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
                  <s-text>{name || "Color"}</s-text>
                  <s-text tone="neutral">{code || "Without code"}</s-text>
                </s-stack>
              </s-stack>
            </s-box>

            <s-stack direction="block" gap="large-400">
              <s-text-field
                label="Name"
                required
                value={name}
                onChange={(e) => setName((e.target as HTMLInputElement).value)}
              />

              <s-text-field
                label="Code"
                required
                value={code}
                onChange={(e) => setCode((e.target as HTMLInputElement).value)}
              />

              <s-stack direction="block" gap="small-200">
                <s-text-field
                  label="Hexadecimal Color"
                  placeholder="#000000"
                  value={hex}
                  onChange={(e) =>
                    handleHexChange((e.target as HTMLInputElement).value)
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
                    <s-text tone="neutral">
                      {patternFile ? patternFile.name : "Current pattern"}
                    </s-text>
                    <s-button
                      variant="tertiary"
                      tone="critical"
                      onClick={handleRemovePattern}
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
                    <s-text tone="neutral">Choose file — no file chosen</s-text>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleFileChange}
                      disabled={hasHex}
                      style={{ display: "none" }}
                    />
                  </label>
                )}
              </s-box>
            </s-stack>
          </s-stack>
        </div>
      </s-box>
    </s-page>
  );
}
