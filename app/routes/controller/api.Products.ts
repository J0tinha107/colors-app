import { authenticate } from "../../shopify.server";
import { listColorMetaobjects } from "./api.Color";
import { AdminClient } from "./api.Color";

type AdminContext = Awaited<ReturnType<typeof authenticate.admin>>["admin"];

const COLOR_OPTION_NAMES = new Set(["cor", "color"]);
const COLOR_METAFIELD_NAMESPACE = "custom";
const COLOR_METAFIELD_KEY = ["color", "cor"];
const MAX_PRODUCT_PER_SCAN = 250;

const LINK_COLOR_OPTION_MUTATION = `#graphql
  mutation LinkColorOption($productId: ID!, $options: [OptionCreateInput!]!, $variantStrategy: ProductOptionCreateVariantStrategy) {
    productOptionsCreate(productId: $productId, options: $options, variantStrategy: $variantStrategy) {
      product { id }
      userErrors { field message }
    }
  }
`;

const UPDATE_COLOR_OPTION_MUTATION = `#graphql
  mutation UpdateColorOption($productId: ID!, $option: OptionUpdateInput!, $optionValuesToAdd: [OptionValueCreateInput!], $variantStrategy: ProductOptionUpdateVariantStrategy) {
    productOptionUpdate(productId: $productId, option: $option, optionValuesToAdd: $optionValuesToAdd, variantStrategy: $variantStrategy) {
      product { id }
      userErrors { field message }
    }
  }
`;

const CONVERT_OPTION_TO_LINKED_MUTATION = `#graphql
  mutation ConvertColorOptionToLinked(
    $productId: ID!
    $option: OptionUpdateInput!
    $optionValuesToUpdate: [OptionValueUpdateInput!]
  ) {
    productOptionUpdate(
      productId: $productId
      option: $option
      optionValuesToUpdate: $optionValuesToUpdate
    ) {
      product { id }
      userErrors { field message }
    }
  }
`;

const SCAN_PRODUCTS_QUERY = `#graphql
  query ScanProductsForColorOptions($first: Int!, $after: String) {
    products(first: $first, after: $after) {
      nodes {
        id
        title
        options {
          id
          name
          linkedMetafield { namespace key }
          optionValues { id name }
        }
      }
      pageInfo { hasNextPage endCursor }
    }
  }
`;

const PRODUCTS_WITH_COLOR_STATUS_QUERY = `#graphql
  query GetProducts($query: String) {
    products(first: 100, query: $query) {
      nodes {
        id
        title
        handle
        status
        productType
        variants(first: 10) {
          nodes { id title }
        }
        vendor
        category { id name fullName }
        totalInventory
        featuredImage { url altText }
        options(first: 5) {
          id
          name
          linkedMetafield { namespace key }
          optionValues { id name linkedMetafieldValue }
        }
      }
    }
  }
`;

export interface VariantNode {
  id: string;
  title: string;
  code: string;
}

export interface ProductOptionValue {
  id: string;
  name: string;
  linkedMetafieldValue: string | null;
}

export interface ProductOption {
  id: string;
  name: string;
  linkedMetafield: { namespace: string; key: string } | null;
  optionValues: ProductOptionValue[];
}

export interface Product {
  id: string;
  title: string;
  handle: string;
  status: string;
  productType: string;
  variants: {
    nodes: VariantNode[];
  };
  vendor: string;
  category: { id: string; name: string; fullName: string } | null;
  totalInventory: number;
  featuredImage: { url: string; altText: string | null } | null;
  options: ProductOption[];
}

export type ProductColorMatch = {
  productId: string;
  productTitle: string;
  optionId: string;
  matched: { valueId: string; valueName: string; colorId: string }[];
  unmatched: string[];
  fullyMatched: boolean;
};

export type ProductColorLink = {
  productId: string;
  optionId: string;
  matched: { valueId: string; colorId: string }[];
};

export async function getProducts(
  admin: AdminContext,
  searchQuery: string = "",
): Promise<Product[]> {
  const response = await admin.graphql(PRODUCTS_WITH_COLOR_STATUS_QUERY, {
      variables: {
        query: searchQuery,
      },
    },
  );

  const json = await response.json();
  return json.data?.products?.nodes ?? [];
}

export async function handleLinkProductColors(admin: AdminContext, formData: FormData) {
  const productId = String(formData.get("productId") ?? "");
  const colorOptionId = (formData.get("colorOptionId") as string) || null;
  const colorIds = formData.getAll("colorId").map(String);

  const values = colorIds.map((id) => ({ metaobjectId: id }));

  try {
    let response;

    if (colorOptionId) {
      response = await admin.graphql(UPDATE_COLOR_OPTION_MUTATION, {
        variables: {
          productId,
          option: { id: colorOptionId },
          optionValuesToAdd: values.map((v) => ({
            linkedMetafieldValue: v.metaobjectId,
          })),
          variantStrategy: "MANAGE",
        },
      });
    } else {
      response = await admin.graphql(LINK_COLOR_OPTION_MUTATION, {
        variables: {
          productId,
          options: [
            {
              name: "Cor",
              linkedMetafield: {
                namespace: "custom",
                key: "color",
                values: values.map((v) => v.metaobjectId),
              },
            },
          ],
          variantStrategy: "CREATE",
        },
      });
    }

    const resJson = (await response.json()) as {
      data?: {
        productOptionUpdate?: { userErrors?: { message: string }[] };
        productOptionsCreate?: { userErrors?: { message: string }[] };
      };
      errors?: { message: string }[];
    };
    const errors = resJson?.data?.productOptionUpdate?.userErrors ?? resJson?.data?.productOptionsCreate?.userErrors;

    if (errors && errors.length > 0) {
      return new Response(JSON.stringify({
        ok: false,
        error: errors.map((e: { message: string }) => e.message).join(", "),
      }), { status: 400, headers: { "Content-Type": "application/json" } });
    }

    if (resJson?.errors) {
      return new Response(JSON.stringify({
        ok: false,
        error: resJson.errors.map((e) => e.message).join(", "),
      }), { status: 400, headers: { "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ ok: true, productId }), { 
      status: 200, 
      headers: { "Content-Type": "application/json" } 
    });

  } catch (err: any) {
    return new Response(JSON.stringify({
      ok: false,
      error: err?.message ?? "Unexpected error while linking.",
    }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
}

export async function scanProductsForColorMatches(
  admin: AdminClient,
): Promise<{ productMatches: ProductColorMatch[]; scannedCount: number }> {
  const colors = await listColorMetaobjects(admin);
  const codeToColorId = new Map(
    colors.filter((c) => c.code).map((c) => [c.code!.trim().toLowerCase(), c.id]),
  );

  const productMatches: ProductColorMatch[] = [];
  let after: string | undefined;
  let scanned = 0;

  while (scanned < MAX_PRODUCT_PER_SCAN) {
    const res = await admin.graphql(SCAN_PRODUCTS_QUERY, {
      variables: { first: 50, after },
    });

    const json = await res.json();
    const page = json.data?.products;

    if (!page) {
      const error = json.errors?.map((item: { message: string }) => item.message).join(", ");
      throw new Error(error || "Shopify did not return products.");
    }

    for (const p of page.nodes) {
      const colorOption = p.options.find(
        (o: any) =>
          COLOR_OPTION_NAMES.has(o.name.trim().toLowerCase()) &&
          !o.linkedMetafield,
      );

      if (!colorOption) continue;

      const matched: { valueId: string; valueName: string; colorId: string }[] = [];
      const unmatched: string[] = [];

      for (const v of colorOption.optionValues) {
        const colorId = codeToColorId.get(v.name.trim().toLowerCase());

        if (colorId) {
          matched.push({ valueId: v.id, valueName: v.name, colorId });
        } else {
          unmatched.push(v.name);
        }
      }

      productMatches.push({
        productId: p.id,
        productTitle: p.title,
        optionId: colorOption.id,
        matched,
        unmatched,
        fullyMatched: unmatched.length === 0 && matched.length > 0,
      });
    }

    scanned += page.nodes.length;

    if (!page.pageInfo.hasNextPage) break;

    after = page.pageInfo.endCursor;
  }

  return { productMatches, scannedCount: scanned };
}

async function applyColorLinks(admin: AdminClient, linksToApply: ProductColorLink[]) {
  const results: { productId: string; ok: boolean; error?: string }[] = [];

  for (const link of linksToApply) {
    try {
      const response = await admin.graphql(CONVERT_OPTION_TO_LINKED_MUTATION, {
        variables: {
          productId: link.productId,
          option: {
            id: link.optionId,
            linkedMetafield: {
              namespace: COLOR_METAFIELD_NAMESPACE,
              key: COLOR_METAFIELD_KEY,
            },
          },
          optionValuesToUpdate: link.matched.map((m) => ({
            id: m.valueId,
            linkedMetafieldValue: m.colorId,
          })),
        },
      });

      const result = await response.json();
      const errors = result?.data?.productOptionUpdate?.userErrors;

      if (errors?.length) {
        results.push({ productId: link.productId, ok: false, error: errors.map((e: any) => e.message).join(", ") });
      } else if (result?.errors) {
        results.push({ productId: link.productId, ok: false, error: result.errors.map((e: any) => e.message).join(", ") });
      } else {
        results.push({ productId: link.productId, ok: true });
      }
    } catch (err: any) {
      results.push({ productId: link.productId, ok: false, error: err?.message });
    }
  }

  return results;
}

export async function handleApplyColorLinks(admin: AdminClient, formData: FormData) {
  const linksRaw = String(formData.get("links") || "");
  console.log("LINKSRAW: ", linksRaw)
  let linksToApply: ProductColorLink[];

  try {
    linksToApply = JSON.parse(linksRaw);
  } catch {
    return new Response(JSON.stringify({ error: "Invalid links payload." }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!Array.isArray(linksToApply) || linksToApply.length === 0) {
    return new Response(JSON.stringify({ error: "No products selected." }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const results = await applyColorLinks(admin, linksToApply);

  return new Response(JSON.stringify({ success: true, results }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}