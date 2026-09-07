import { useLoaderData, useFetcher } from "react-router";
import { useState, useMemo } from "react";
import { authenticate } from "../shopify.server";
import { scanProductsForColorMatches } from "./controller/api.Products";
import type { LoaderFunctionArgs } from "react-router";

export async function loader({ request }: LoaderFunctionArgs) {
  const { admin } = await authenticate.admin(request);
  const { productMatches, scannedCount } =
    await scanProductsForColorMatches(admin);
  return { productMatches, scannedCount };
}

export default function AutoLinkColorsPage() {
  const { productMatches, scannedCount } = useLoaderData<typeof loader>();
  const fetcher = useFetcher<{
    success?: boolean;
    results?: { productId: string; ok: boolean; error?: string }[];
    error?: string;
  }>();
  const isRunning = fetcher.state !== "idle";

  const readyToLink = useMemo(
    () => productMatches.filter((c) => c.fullyMatched),
    [productMatches],
  );
  const needsAttention = useMemo(
    () => productMatches.filter((c) => !c.fullyMatched),
    [productMatches],
  );

  const [selectedIds, setSelectedIds] = useState<string[]>(
    readyToLink.map((c) => c.productId),
  );

  function toggle(productId: string) {
    setSelectedIds((prev) =>
      prev.includes(productId)
        ? prev.filter((id) => id !== productId)
        : [...prev, productId],
    );
  }

  function handleRun() {
    const linksToApply = readyToLink
      .filter((c) => selectedIds.includes(c.productId))
      .map((c) => ({
        productId: c.productId,
        optionId: c.optionId,
        matched: c.matched.map((m) => ({
          valueId: m.valueId,
          colorId: m.colorId,
        })),
      }));

    const formData = new FormData();
    formData.append("actionType", "RUN");
    formData.append("links", JSON.stringify(linksToApply));

    fetcher.submit(formData, {
      action: "/api/autoLinkColors",
      method: "post",
    });
  }

  const linkedCount = fetcher.data?.results?.filter((r) => r.ok).length ?? 0;
  const totalCount = fetcher.data?.results?.length ?? 0;

  return (
    <s-page heading="Auto-link colors">
      <s-stack direction="block" gap="large-400">
        {fetcher.data?.results && (
          <s-banner
            heading={`Linked ${linkedCount} of ${totalCount} products.`}
            tone={linkedCount === totalCount ? "success" : "warning"}
          />
        )}
        {fetcher.data?.error && (
          <s-banner heading={fetcher.data.error} tone="critical" />
        )}

        <s-grid gridTemplateColumns="1fr 1fr 1fr" gap="large-300">
          <s-box background="base" borderRadius="base" padding="large-300">
            <s-stack direction="block" gap="small-200">
              <s-text tone="neutral">Scanned</s-text>
              <s-text>{scannedCount}</s-text>
            </s-stack>
          </s-box>
          <s-box background="base" borderRadius="base" padding="large-300">
            <s-stack direction="block" gap="small-200">
              <s-text tone="success">Ready to link</s-text>
              <s-text>{readyToLink.length}</s-text>
            </s-stack>
          </s-box>
          <s-box background="base" borderRadius="base" padding="large-300">
            <s-stack direction="block" gap="small-200">
              <s-text tone="critical">Needs attention</s-text>
              <s-text>{needsAttention.length}</s-text>
            </s-stack>
          </s-box>
        </s-grid>

        <s-box background="base" borderRadius="base" padding="large-300">
          <s-stack direction="block" gap="large-300">
            <s-stack direction="inline" gap="large-200" alignItems="center">
              <s-text>{`Ready to link (${readyToLink.length})`}</s-text>
              <s-button
                variant="primary"
                loading={isRunning}
                disabled={selectedIds.length === 0}
                onClick={handleRun}
              >
                {`Link ${selectedIds.length} product(s)`}
              </s-button>
            </s-stack>

            {readyToLink.length === 0 ? (
              <s-text tone="neutral">
                No products currently have every color code matched.
              </s-text>
            ) : (
              <s-stack direction="block" gap="small-200">
                {readyToLink.map((c) => (
                  <s-stack
                    key={c.productId}
                    direction="inline"
                    gap="small-200"
                    alignItems="center"
                  >
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(c.productId)}
                      onChange={() => toggle(c.productId)}
                    />
                    <s-text>{c.productTitle}</s-text>
                    <s-text tone="neutral">
                      — {c.matched.map((m) => m.valueName).join(", ")}
                    </s-text>
                  </s-stack>
                ))}
              </s-stack>
            )}
          </s-stack>
        </s-box>

        <s-box background="base" borderRadius="base" padding="large-300">
          <s-stack direction="block" gap="large-300">
            <s-text>{`Needs attention (${needsAttention.length})`}</s-text>

            {needsAttention.length === 0 ? (
              <s-text tone="neutral">Everything is matched.</s-text>
            ) : (
              <s-stack direction="block" gap="small-200">
                {needsAttention.map((c) => (
                  <s-stack
                    key={c.productId}
                    direction="inline"
                    gap="small-200"
                    alignItems="center"
                  >
                    <s-text>{c.productTitle}</s-text>
                    <s-badge tone="warning">
                      {c.unmatched.join(", ") ||
                        "already linked / no color option"}
                    </s-badge>
                  </s-stack>
                ))}
              </s-stack>
            )}
          </s-stack>
        </s-box>
      </s-stack>
    </s-page>
  );
}
