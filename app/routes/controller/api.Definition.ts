import type { AdminClient } from "./api.Color.types";

const COLOR_METAOBJECT_TYPE = "color";
const COLOR_METAFIELD_KEY = "color";
const COLOR_METAFIELD_NAMESPACE = "custom";

const CREATE_DEFINITION_MUTATION = `#graphql
  mutation CreateMetaobjectDefinition($definition: MetaobjectDefinitionCreateInput!) {
    metaobjectDefinitionCreate(definition: $definition) {
      metaobjectDefinition { id type displayNameKey }
      userErrors { field message }
    }
  }
`;

const METAOBJECT_DEFINITION_BY_TYPE_QUERY = `#graphql
  query GetColorMetaobjectDefinition($type: String!) {
    metaobjectDefinitionByType(type: $type) { id }
  }
`;

const CREATE_METAFIELD_DEFINITION_MUTATION = `#graphql
  mutation CreateColorMetafieldDefinition($definition: MetafieldDefinitionInput!) {
    metafieldDefinitionCreate(definition: $definition) {
      createdDefinition { id }
      userErrors { field message }
    }
  }
`;

export async function ensureColorMetaobjectDefinition(admin: AdminClient) {
  const response = await admin.graphql(CREATE_DEFINITION_MUTATION, {
    variables: {
      definition: {
        name: "Color",
        type: COLOR_METAOBJECT_TYPE,
        displayNameKey: "code",
        fieldDefinitions: [
          { key: "name", name: "Name", type: "single_line_text_field" },
          { key: "code", name: "Code", type: "single_line_text_field" },
          { key: "swatch_color", name: "Swatch color", type: "color" },
          { key: "pattern", name: "Pattern", type: "file_reference" },
        ],
      },
    },
  });

  const json = await response.json();
  console.log("ensureColorMetaobjectDefinition result:", JSON.stringify(json, null, 2));
  return json;
}

export async function getColorMetaobjectDefinitionId(admin: AdminClient) {
  const response = await admin.graphql(METAOBJECT_DEFINITION_BY_TYPE_QUERY, {
    variables: { type: COLOR_METAOBJECT_TYPE },
  });
  const json = await response.json();
  return json.data?.metaobjectDefinitionByType?.id as string | undefined;
}

export async function ensureColorMetafieldDefinition(admin: AdminClient, metaobjectDefinitionId: string) {
  const response = await admin.graphql(CREATE_METAFIELD_DEFINITION_MUTATION, {
    variables: {
      definition: {
        name: "Color",
        namespace: COLOR_METAFIELD_NAMESPACE,
        key: COLOR_METAFIELD_KEY,
        type: "list.metaobject_reference",
        ownerType: "PRODUCT",
        validations: [{ name: "metaobject_definition_id", value: metaobjectDefinitionId }],
      },
    },
  });
  const json = await response.json();
  const error = json.data?.metafieldDefinitionCreate?.userErrors?.[0]?.message;
  if (error && !error.toLowerCase().includes("already exists")) {
    console.error("Failed to create color metafield definition:", error);
  }
}