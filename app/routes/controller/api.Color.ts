import db from "../../db.server";
import { uploadImageToShopify } from "./api.File";

const COLOR_METAOBJECT_TYPE = "color";

const CREATE_METAOBJECT_MUTATION = `#graphql
  mutation CreateMetaObject($metaobject: MetaobjectCreateInput!) {
    metaobjectCreate(metaobject: $metaobject) {
      metaobject { id handle }
      userErrors { field message }
    }
  }
`;

const GET_METAOBJECT_BY_ID_QUERY = `#graphql
  query GetColorMetaobject($id: ID!) {
    metaobject(id: $id) {
      id
      handle
      fields { key value }
    }
  }
`;

const UPDATE_METAOBJECT_MUTATION = `#graphql
  mutation UpdateMetaobject($id: ID!, $metaobject: MetaobjectUpdateInput!) {
    metaobjectUpdate(id: $id, metaobject: $metaobject) {
      metaobject { id handle }
      userErrors { field message }
    }
  }
`;

const DELETE_METAOBJECT_MUTATION = `#graphql
  mutation DeleteMetaobject($id: ID!) {
    metaobjectDelete(id: $id) {
      deletedId
      userErrors { field message }
    }
  }
`;

const LIST_METAOBJECTS_QUERY = `#graphql
  query ListColors($first: Int!, $after: String) {
    metaobjects(type: "color", first: $first, after: $after) {
      nodes { id handle fields { key value } }
      pageInfo { hasNextPage endCursor }
    }
  }
`;

export type ColorMetaobject = {
  id: string;
  handle: string;
  name?: string;
  code?: string;
  swatchColor?: string;
  patternFileId?: string;
  patternUrl?: string;
};

export type AdminClient = {
    graphql: (query: string, opts?: { variables?: Record<string, unknown> }) => Promise<Response>;
};

export async function isColorCodeTaken( shopDomain: string, code: string, excludeShopifyMetaobjectId?: string,): Promise<boolean> {
  const normalizedCode = code.trim().toLowerCase();
  const existing = await db.colors.findFirst({
    where: {
      shopDomain,
      code: normalizedCode,
      ...(excludeShopifyMetaobjectId ? { shopifyMetaobjectId: { not: excludeShopifyMetaobjectId } } : {}),
    },
  });

  return !!existing;
}

export async function handleAddColor(admin: AdminClient, formData: FormData) {
  const name = String(formData.get("name") || "").trim();
  const code = String(formData.get("code") || "").trim();
  const hex = String(formData.get("hex") || "").trim();
  const patternField = formData.get("pattern");

  let patternFileId: string | undefined;

  if (patternField instanceof File) {
    const uploadResult = await uploadImageToShopify(admin, patternField);

    if (uploadResult.error || !uploadResult.fileId) {
      return new Response(JSON.stringify({ error: uploadResult.error || "Failed to upload the pattern image." }), { status: 400, headers: { "Content-Type": "application/json" } });
    }

    patternFileId = uploadResult.fileId;
  }

  const fields = [
    { key: "name", value: name},
    { key: "code", value: code},
  ];

  if (hex) {
    fields.push({ key: "swatch_color", value: hex });
  }

  if (patternFileId) {
    fields.push({ key: "pattern", value: patternFileId });
  }

  const response = await admin.graphql(CREATE_METAOBJECT_MUTATION, {
    variables: {
      metaobject: {
        type: COLOR_METAOBJECT_TYPE,
        fields,
        capabilities: { publishable: { status: "ACTIVE" } },
      },
    },
  });

  const result = await response.json();
  const error = result?.data?.metaobjectCreate?.userErrors?.[0]?.message || result?.errors?.[0]?.message;

  if (error) {
    return new Response(JSON.stringify({ error }), { status: 400, headers: { "Content-Type": "application/json" } });
  }

  return new Response(JSON.stringify({ success: true }), { status: 201, headers: { "Content-Type": "application/json" } });
}

export async function getColorMetaobjectById(admin: AdminClient, id: string): Promise<ColorMetaobject | null> {
  const response = await admin.graphql(GET_METAOBJECT_BY_ID_QUERY, { variables: { id } });
  const json = await response.json();
  const node = json.data?.metaobject;
  if (!node) return null;

  const color = mapFields(node);
  if (color.patternFileId) {
    color.patternUrl = await resolvePatternUrl(admin, color.patternFileId);
  }

  return color;
}

export async function handleEditColor(admin: AdminClient, formData: FormData) {
  const id = String(formData.get("id") || "").trim();
  const name = String(formData.get("name") || "").trim();
  const code = String(formData.get("code") || "").trim();
  const hex = String(formData.get("hex") || "").trim();
  const removePattern = formData.get("removePattern") === "true";
  const patternFile = formData.get("pattern");

  let patternFileId: string | undefined;

  if (patternFile instanceof File && patternFile.size > 0) {
    const uploadResult = await uploadImageToShopify(admin, patternFile);

    if (uploadResult.error) {
      return new Response(JSON.stringify({ error: uploadResult.error }), { status: 400, headers: { "Content-Type": "application/json" } });
    }

    patternFileId = uploadResult.fileId;

  } else if (!removePattern && !hex) {
    const current = await getColorMetaobjectById(admin, id);
    
    patternFileId = current?.patternFileId;
  }

  if (!hex && !patternFileId) {
    return new Response(JSON.stringify({ error: "Escolhe uma cor sólida ou uma imagem de padrão." }), { status: 400, headers: { "Content-Type": "application/json" } });
  }

  const fields = [
    { key: "name", value: name },
    { key: "code", value: code },
    { key: "swatch_color", value: hex || "" },
    { key: "pattern", value: hex ? "" : (patternFileId || "") },
  ];

  const response = await admin.graphql(UPDATE_METAOBJECT_MUTATION, {
    variables: { id, metaobject: { fields } },
  });

  const result = await response.json();
  const error = result?.data?.metaobjectUpdate?.userErrors?.[0]?.message || result?.errors?.[0]?.message;

  if (error) {
    return new Response(JSON.stringify({ error }), { status: 400, headers: { "Content-Type": "application/json" } });
  }

  return new Response(JSON.stringify({ success: true }), { status: 200, headers: { "Content-Type": "application/json" } });
}

export async function handleDeleteColor(admin: AdminClient, formData: FormData) {
  const id = String(formData.get("id") || "").trim();

 const response = await admin.graphql(DELETE_METAOBJECT_MUTATION, {
    variables: { id },
  });

  const result = await response.json();
  const error = result?.data?.metaobjectDelete?.userErrors?.[0]?.message || result?.errors?.[0]?.message;

  if (error) {
    return new Response(JSON.stringify({ error }), { status: 400, headers: { "Content-Type": "application/json" } });
  }

  return new Response(JSON.stringify({ success: true }), { status: 200, headers: { "Content-Type": "application/json" } });
}

function mapFields(node: { id: string; handle: string; fields: { key: string; value: string }[] }): ColorMetaobject {
  const get = (key: string) => node.fields.find((f) => f.key === key)?.value;
  return {
    id: node.id,
    handle: node.handle,
    name: get("name"),
    code: get("code"),
    swatchColor: get("swatch_color"),
    patternFileId: get("pattern"),
    patternUrl: undefined,
  };
}

export async function resolvePatternUrl(admin: AdminClient, fileId: string): Promise<string | undefined> {
  if (!fileId) return undefined;
  if (fileId.startsWith("http://") || fileId.startsWith("https://")) {
    return fileId;
  }

  const response = await admin.graphql(
    `#graphql
      query GetFileUrl($id: ID!) {
        node(id: $id) {
          __typename
          ... on GenericFile { url }
          ... on MediaImage { image { url } }
        }
      }
    `,
    { variables: { id: fileId } },
  );

  const json = await response.json();
  return json.data?.node?.url ?? json.data?.node?.image?.url ?? undefined;
}

export async function listColorMetaobjects(admin: AdminClient): Promise<ColorMetaobject[]> {
  const colors: ColorMetaobject[] = [];
  let after: string | undefined;

  while (true) {
    const response = await admin.graphql(LIST_METAOBJECTS_QUERY, { variables: { first: 250, after } });
    const json = await response.json();
    const page = json.data.metaobjects;

    const mapped = await Promise.all(
      page.nodes.map(async (node: { id: string; handle: string; fields: { key: string; value: string }[] }) => {
        const color = mapFields(node);
        if (color.patternFileId) {
          color.patternUrl = await resolvePatternUrl(admin, color.patternFileId);
        }
        return color;
      }),
    );

    colors.push(...mapped);
    if (!page.pageInfo.hasNextPage) break;
    after = page.pageInfo.endCursor;
  }

  return colors;
}