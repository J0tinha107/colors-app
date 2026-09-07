import { AdminClient } from './api.Color';

export type uploadImageResult = 
    | { fileId: string; error?: undefined }
    | { fileId?: string; error: string };

export async function uploadImageToShopify(admin: AdminClient, file: File): Promise<uploadImageResult> {
    const stagedRes = await admin.graphql(
        `#graphql
            mutation stagedUploadsCreate($input: [StagedUploadInput!]!) {
                stagedUploadsCreate(input: $input) {
                    stagedTargets { url resourceUrl parameters { name value } }
                    userErrors { field message }
                }
            }
        `,
        {
            variables: {
                input: [
                    { filename: file.name, mimeType: file.type, resource: 'IMAGE', fileSize: String(file.size), httpMethod: "POST" },
                ],
            },
        },
    );

    const stagedJson = await stagedRes.json();
    const target = stagedJson.data?.stagedUploadsCreate?.stagedTargets?.[0];
    if (!target || stagedJson.data?.stagedUploadsCreate?.userErrors?.length) {
        return { error: "Failed to prepare image upload." };
    }

    const uploadForm = new FormData();
    target.parameters.forEach((p: { name: string; value: string }) => uploadForm.append(p.name, p.value));
    uploadForm.append("file", file);
    const uploadRes = await fetch(target.url, { method: "POST", body: uploadForm });

    if (!uploadRes.ok) {
        return { error: "Failed to send the image to Shopify." }
    }

    const fileCreateRes = await admin.graphql(
        `#graphql
            mutation fileCreate($files: [FileCreateInput!]!) {
                fileCreate(files: $files) {
                    files { id fileStatus }
                    userErrors { field message }
                }
            }
        `,
        { variables: { files: [{ originalSource: target.resourceUrl, contentType: "IMAGE" }] } }, 
    );

    const fileJson = await fileCreateRes.json();
    const createdFile = fileJson.data?.fileCreate?.files?.[0];
    
    if (!createdFile || fileJson.data?.fileCreate?.userErrors?.length) {
        return { error: "Failed to register the image in Shopify."}
    }

    return { fileId: createdFile.id };
}