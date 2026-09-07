import { useState, useEffect, useMemo } from "react";
import { useLoaderData, useFetcher, useRevalidator } from "react-router";
import { authenticate } from "../shopify.server";
import { getProducts } from "./controller/api.Products";
import { listColorMetaobjects } from "./controller/api.Color";
import type { LoaderFunctionArgs } from "react-router";

export async function loader({ request }: LoaderFunctionArgs) {
  const { admin } = await authenticate.admin(request);
  const rawProducts = await getProducts(admin);
  const colors = await listColorMetaobjects(admin);

  const products = rawProducts.map((p: any) => {
    const colorOption = p.options?.find(
      (o: any) =>
        o.linkedMetafield?.namespace === "custom" &&
        o.linkedMetafield?.key === "color",
    );

    const linkedColorMetaobjectIds: string[] =
      colorOption?.optionValues
        ?.filter((v: any) => v.linkedMetafieldValue)
        ?.map((v: any) => v.linkedMetafieldValue) ?? [];

    const linkedColorNames: string[] =
      colorOption?.optionValues
        ?.filter((v: any) => v.linkedMetafieldValue)
        ?.map((v: any) => v.name) ?? [];

    return {
      id: p.id,
      title: p.title,
      imageUrl: p.featuredImage?.url ?? null,
      colorOptionId: colorOption?.id ?? null,
      linkedColorMetaobjectIds,
      linkedColorNames,
      isLinked: linkedColorNames.length > 0,
    };
  });

  return { products, colors };
}

type Product = {
  id: string;
  title: string;
  imageUrl: string | null;
  colorOptionId: string | null;
  linkedColorMetaobjectIds: string[];
  linkedColorNames: string[];
  isLinked: boolean;
};

type ColorEntry = {
  id: string;
  name?: string;
  code?: string;
  swatchColor?: string;
  patternFileId?: string;
};

export default function ProductColorsPage() {
  const { products, colors } = useLoaderData() as {
    products: Product[];
    colors: ColorEntry[];
  };

  const [searchValue, setSearchValue] = useState("");
  const [filter, setFilter] = useState<"all" | "linked" | "not-linked">("all");
  const [modalProduct, setModalProduct] = useState<Product | null>(null);
  const [selectedColorIds, setSelectedColorIds] = useState<string[]>([]);
  const [colorSearchValue, setColorSearchValue] = useState("");
  const [banner, setBanner] = useState<{
    tone: "success" | "critical";
    message: string;
  } | null>(null);

  const fetcher = useFetcher<{ ok: boolean; error?: string }>();
  const revalidator = useRevalidator();
  const isSaving = fetcher.state !== "idle";

  useEffect(() => {
    if (fetcher.state !== "idle" || !fetcher.data) return;

    if (fetcher.data.ok) {
      setBanner({ tone: "success", message: "Color(s) linked successfully." });
      setModalProduct(null);
      setSelectedColorIds([]);
      revalidator.revalidate();
    } else {
      setBanner({
        tone: "critical",
        message: fetcher.data.error ?? "Failed to link colors.",
      });
    }
  }, [fetcher.state, fetcher.data]);

  const filteredProducts = products
    .filter((p) => {
      if (filter === "linked") return p.isLinked;
      if (filter === "not-linked") return !p.isLinked;
      return true;
    })
    .filter((p) =>
      searchValue.trim() === ""
        ? true
        : p.title.toLowerCase().includes(searchValue.trim().toLowerCase()),
    );

  function openModal(product: Product) {
    setModalProduct(product);
    setSelectedColorIds([]);
    setColorSearchValue("");
    setBanner(null);
  }

  function toggleColor(colorId: string) {
    setSelectedColorIds((prev) =>
      prev.includes(colorId)
        ? prev.filter((id) => id !== colorId)
        : [...prev, colorId],
    );
  }

  function handleLink() {
    if (!modalProduct || selectedColorIds.length === 0) return;

    const formData = new FormData();
    formData.append("actionType", "LINK_PRODUCT");
    formData.append("productId", modalProduct.id);
    if (modalProduct.colorOptionId) {
      formData.append("colorOptionId", modalProduct.colorOptionId);
    }
    selectedColorIds.forEach((colorId) => formData.append("colorId", colorId));

    fetcher.submit(formData, { action: "/api/product", method: "post" });
  }

  const availableColors = modalProduct
    ? colors.filter(
        (c) => !modalProduct.linkedColorMetaobjectIds.includes(c.id),
      )
    : [];

  const filteredAvailableColors = useMemo(() => {
    const query = colorSearchValue.trim().toLowerCase();
    if (!query) return availableColors;
    return availableColors.filter((c) => {
      const name = (c.name ?? "").toLowerCase();
      const code = (c.code ?? "").toLowerCase();
      return name.includes(query) || code.includes(query);
    });
  }, [availableColors, colorSearchValue]);

  return (
    <s-page heading="Products & colors">
      <s-stack direction="block" gap="large-400">
        {banner && <s-banner heading={banner.message} tone={banner.tone} />}

        <s-box background="base" borderRadius="base" padding="large-300">
          <s-stack direction="block" gap="large-300">
            <s-text-field
              label="Search products"
              labelAccessibilityVisibility="exclusive"
              placeholder="Search products..."
              value={searchValue}
              onChange={(e) =>
                setSearchValue((e.target as HTMLInputElement).value)
              }
            />

            <s-stack direction="inline" gap="small-200">
              <s-button
                variant={filter === "all" ? "primary" : "tertiary"}
                onClick={() => setFilter("all")}
              >
                {`All (${products.length})`}
              </s-button>
              <s-button
                variant={filter === "linked" ? "primary" : "tertiary"}
                onClick={() => setFilter("linked")}
              >
                {`Linked (${products.filter((p) => p.isLinked).length})`}
              </s-button>
              <s-button
                variant={filter === "not-linked" ? "primary" : "tertiary"}
                onClick={() => setFilter("not-linked")}
              >
                {`Not linked (${products.filter((p) => !p.isLinked).length})`}
              </s-button>
            </s-stack>

            {filteredProducts.length === 0 ? (
              <s-text tone="neutral">
                Try a different tab or search term.
              </s-text>
            ) : (
              <s-stack direction="block" gap="small-200">
                {filteredProducts.map((product) => (
                  <s-stack
                    key={product.id}
                    direction="inline"
                    gap="large-200"
                    alignItems="center"
                  >
                    {product.imageUrl && (
                      <img
                        src={product.imageUrl}
                        alt={product.title}
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: 6,
                          objectFit: "cover",
                        }}
                      />
                    )}
                    <s-text style={{ flex: 1 }}>{product.title}</s-text>
                    <s-badge tone={product.isLinked ? "success" : "warning"}>
                      {product.isLinked ? "Linked" : "Not linked"}
                    </s-badge>
                    <s-text tone="neutral">
                      {product.isLinked
                        ? product.linkedColorNames.join(", ")
                        : "—"}
                    </s-text>
                    <s-button onClick={() => openModal(product)}>
                      Link color
                    </s-button>
                  </s-stack>
                ))}
              </s-stack>
            )}
          </s-stack>
        </s-box>

        {modalProduct && (
          <s-modal
            heading={`Link colors to ${modalProduct.title}`}
            onHide={() => setModalProduct(null)}
          >
            {availableColors.length === 0 ? (
              <s-text tone="neutral">
                All available colors are already linked to this product.
              </s-text>
            ) : (
              <s-stack direction="block" gap="large-300">
                <s-text-field
                  label="Search colors"
                  labelAccessibilityVisibility="exclusive"
                  placeholder="Search by name or code..."
                  value={colorSearchValue}
                  onChange={(e) =>
                    setColorSearchValue((e.target as HTMLInputElement).value)
                  }
                />

                {filteredAvailableColors.length === 0 ? (
                  <s-text tone="neutral">No colors match your search.</s-text>
                ) : (
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 12,
                      maxHeight: 320,
                      overflowY: "auto",
                    }}
                  >
                    {filteredAvailableColors.map((color) => (
                      <label
                        key={color.id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={selectedColorIds.includes(color.id)}
                          onChange={() => toggleColor(color.id)}
                        />
                        <s-text>
                          {color.name || "Unnamed"} ({color.code || "No code"})
                        </s-text>
                      </label>
                    ))}
                  </div>
                )}
              </s-stack>
            )}

            <s-button
              slot="primary-action"
              variant="primary"
              loading={isSaving}
              disabled={selectedColorIds.length === 0 || isSaving}
              onClick={handleLink}
            >
              Link color(s)
            </s-button>
            <s-button
              slot="secondary-actions"
              onClick={() => setModalProduct(null)}
            >
              Cancel
            </s-button>
          </s-modal>
        )}
      </s-stack>
    </s-page>
  );
}
