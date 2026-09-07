import { useState, useMemo } from "react";
import { useLoaderData, useFetcher, useNavigate } from "react-router";
import { authenticate } from "../shopify.server";
import { listColorMetaobjects } from "./controller/api.Color";
import type { LoaderFunctionArgs } from "react-router";

export async function loader({ request }: LoaderFunctionArgs) {
  const { admin } = await authenticate.admin(request);
  const colors = await listColorMetaobjects(admin);
  return { colors };
}

export default function Index() {
  const { colors } = useLoaderData<typeof loader>();
  const deleteFetcher = useFetcher();
  const navigate = useNavigate();

  const [searchValue, setSearchValue] = useState("");

  const handleDelete = (id: string, name: string) => {
    if (!confirm(`Delete color "${name}"?`)) return;

    const formData = new FormData();
    formData.append("actionType", "DELETE");
    formData.append("id", id);

    deleteFetcher.submit(formData, {
      action: "/api/color",
      method: "post",
    });
  };

  const filteredColors = useMemo(() => {
    const query = searchValue.trim().toLowerCase();
    if (!query) return colors;

    return colors.filter((c) => {
      const name = (c.name ?? "").toLowerCase();
      const code = (c.code ?? "").toLowerCase();
      return name.includes(query) || code.includes(query);
    });
  }, [colors, searchValue]);

  return (
    <s-page heading="Colors">
      <s-button
        slot="primary-action"
        variant="primary"
        onClick={() => navigate("/app/addColor")}
      >
        Add color
      </s-button>

      <s-box padding="large-100">
        <s-text-field
          label="Search colors"
          labelAccessibilityVisibility="exclusive"
          placeholder="Search by name or code..."
          value={searchValue}
          onChange={(e) => setSearchValue((e.target as HTMLInputElement).value)}
        />
      </s-box>

      {colors.length === 0 ? (
        <s-box padding="large-400">
          <s-stack direction="block" gap="small-200" alignItems="center">
            <s-text>No colors yet.</s-text>
            <s-button
              variant="primary"
              onClick={() => navigate("/app/addColor")}
            >
              Add color
            </s-button>
          </s-stack>
        </s-box>
      ) : filteredColors.length === 0 ? (
        <s-box padding="large-400">
          <s-text tone="neutral">No colors match your search.</s-text>
        </s-box>
      ) : (
        <s-box padding="large-100">
          <s-stack direction="block" gap="small-100">
            {filteredColors.map((color) => (
              <s-box
                key={color.id}
                padding="small-300"
                borderRadius="base"
                borderWidth="base"
              >
                <s-stack direction="inline" gap="large-300" alignItems="center">
                  {color.patternUrl ? (
                    <div
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 6,
                        border: "1px solid #ccc",
                        overflow: "hidden",
                        background: "#fff",
                        flexShrink: 0,
                      }}
                    >
                      <img
                        src={color.patternUrl}
                        alt={color.name || "Pattern preview"}
                        style={{
                          width: "100%",
                          height: "100%",
                          objectFit: "cover",
                          display: "block",
                        }}
                      />
                    </div>
                  ) : (
                    <div
                      style={{
                        width: 24,
                        height: 24,
                        borderRadius: "50%",
                        border: "1px solid #ccc",
                        backgroundColor: color.swatchColor || "#f1f1f1",
                        flexShrink: 0,
                      }}
                    />
                  )}

                  <s-stack
                    direction="block"
                    gap="small-100"
                    style={{ flex: 1 }}
                  >
                    <s-text>{color.name}</s-text>
                    <s-text tone="neutral">{color.code}</s-text>
                  </s-stack>

                  <s-stack direction="inline" gap="small-200">
                    <s-button
                      variant="primary"
                      tone="success"
                      onClick={() =>
                        navigate(
                          `/app/editColor/${encodeURIComponent(color.id)}`,
                        )
                      }
                    >
                      Edit
                    </s-button>
                    <s-button
                      variant="primary"
                      tone="critical"
                      disabled={deleteFetcher.state !== "idle"}
                      onClick={() =>
                        handleDelete(color.id, color.name || color.code || "")
                      }
                    >
                      Delete
                    </s-button>
                  </s-stack>
                </s-stack>
              </s-box>
            ))}
          </s-stack>
        </s-box>
      )}
    </s-page>
  );
}
