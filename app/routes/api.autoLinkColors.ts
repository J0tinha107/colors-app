import { type ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { handleApplyColorLinks } from "./controller/api.Products";

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }
  console.log("entrei no post")

  const { admin } = await authenticate.admin(request);
  const formData = await request.formData();
  const actionType = formData.get("actionType")?.toString();

  try {
     if (actionType === "RUN") {
    return handleApplyColorLinks(admin, formData);
  }

    return new Response(JSON.stringify({ error: "Invalid action type" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || "Internal Server Error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}