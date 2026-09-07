import { type ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { isColorCodeTaken, handleAddColor, handleEditColor, handleDeleteColor } from "./controller/api.Color";

export async function action({ request }: ActionFunctionArgs) {
    if (request.method !== "POST") {
        return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: { "Content-Type": "application/json" } });
    }

    const { admin, session } = await authenticate.admin(request);
    const formData = await request.formData();
    const actionType = formData.get("actionType")?.toString();

    try {

        // Validation to Add Colors
        if (actionType === "ADD") {
            const name = String(formData.get("name") || "").trim();
            const code = String(formData.get("code") || "").trim();
            const hex = String(formData.get("hex") || "").trim();
            const patternField = formData.get("pattern");

            if (!name || !code) {
                return new Response(JSON.stringify({ error: "Name and code are required" }), { status: 400, headers: { "Content-Type": "application/json" } });
            }

            if (hex && !/^#[0-9a-fA-F]{6}$/.test(hex)) {
                return new Response(JSON.stringify({ error: "Please provide a valid 6-character hex color." }), { status: 400, headers: { "Content-Type": "application/json" } });
            }

            if (await isColorCodeTaken(session.shop, code)) {
                return new Response(JSON.stringify({ error: "A color with this code already exists for this shop."}), { status: 400, headers: { "Content-Type": "application/json" } });
            }

            if (!hex && !(patternField instanceof File)) {
                return new Response(JSON.stringify({ error: "Please choose a hexedacimal color or upload a pattern image." }), { status: 400, headers: { "Content-Type": "application/json" } });
            }

            return await handleAddColor(admin, formData);
        }

        // Validation to Edit Colors
        if (actionType === "EDIT") {
            const id = String(formData.get("id") || "").trim();
            const name = String(formData.get("name") || "").trim();
            const code = String(formData.get("code") || "").trim();
            const hex = String(formData.get("hex") || "").trim();

            if (!id) {
                return new Response(JSON.stringify({ error: "Missing color id." }), { status: 400, headers: { "Content-Type": "application/json" } });
            }

            if (!name || !code) {
                return new Response(JSON.stringify({ error: "Nome e código são obrigatórios." }), { status: 400, headers: { "Content-Type": "application/json" } });
            }

            if (hex && !/^#[0-9a-fA-F]{6}$/.test(hex)) {
                return new Response(JSON.stringify({ error: "Escolhe uma cor válida com seis caracteres hexadecimais." }), { status: 400, headers: { "Content-Type": "application/json" } });
            }

            if (await isColorCodeTaken(session.shop, code, id)) {
                return new Response(JSON.stringify({ error: "This color code is already in use for this shop." }), { status: 400, headers: { "Content-Type": "application/json" } });
            }

            return await handleEditColor(admin, formData);
        }

        // Validation to Delete Colors
        if (actionType === "DELETE") {
            const id = String(formData.get("id") || "").trim();

            if (!id) {
                return new Response(JSON.stringify({ error: "ID is required for deletion."}), { status: 400, headers: { "Content-Type": "application/json"} });
            }

            return await handleDeleteColor(admin, formData);
        }

        return new Response(JSON.stringify({ error: "Invalid actoin type" }), { status: 400, headers: { "Content-Type": "application/json" } });

    } catch(err: any) {
        return new Response(JSON.stringify({ error: err.message || "Internal Server Error" }), { status: 500, headers: { "Content-Type": "application/json" } });
    }
}