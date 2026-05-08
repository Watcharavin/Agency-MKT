// ─── LINE OA Messaging API ──────────────────────────────────────────────
export async function postToLINE(accessToken: string, message: string, imageUrl?: string) {
  const messages: Array<{ type: string; text?: string; originalContentUrl?: string; previewImageUrl?: string }> = [];

  if (imageUrl) {
    messages.push({
      type: "image",
      originalContentUrl: imageUrl,
      previewImageUrl: imageUrl,
    });
  }

  if (message) {
    messages.push({ type: "text", text: message });
  }

  const res = await fetch("https://api.line.me/v2/bot/message/broadcast", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ messages }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`LINE API error ${res.status}: ${JSON.stringify(err)}`);
  }

  return { success: true };
}

// ─── Facebook Page Post ─────────────────────────────────────────────────
export async function postToFacebook(pageAccessToken: string, pageId: string, message: string, imageUrl?: string) {
  let endpoint: string;
  const params = new URLSearchParams({ access_token: pageAccessToken });

  if (imageUrl) {
    endpoint = `https://graph.facebook.com/v21.0/${pageId}/photos`;
    params.set("url", imageUrl);
    params.set("message", message);
  } else {
    endpoint = `https://graph.facebook.com/v21.0/${pageId}/feed`;
    params.set("message", message);
  }

  const res = await fetch(endpoint, {
    method: "POST",
    body: params,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Facebook API error ${res.status}: ${JSON.stringify(err)}`);
  }

  const data = await res.json();
  return {
    success: true,
    postId: data.id || data.post_id,
    postUrl: `https://facebook.com/${data.id || data.post_id}`,
  };
}

// ─── Instagram Business (via Facebook Graph API) ────────────────────────
export async function postToInstagram(pageAccessToken: string, igUserId: string, message: string, imageUrl: string) {
  // Step 1: Create media container
  const containerRes = await fetch(
    `https://graph.facebook.com/v21.0/${igUserId}/media`,
    {
      method: "POST",
      body: new URLSearchParams({
        access_token: pageAccessToken,
        image_url: imageUrl,
        caption: message,
      }),
    }
  );

  if (!containerRes.ok) {
    const err = await containerRes.json().catch(() => ({}));
    throw new Error(`Instagram container error ${containerRes.status}: ${JSON.stringify(err)}`);
  }

  const { id: containerId } = await containerRes.json();

  // Step 2: Publish
  const publishRes = await fetch(
    `https://graph.facebook.com/v21.0/${igUserId}/media_publish`,
    {
      method: "POST",
      body: new URLSearchParams({
        access_token: pageAccessToken,
        creation_id: containerId,
      }),
    }
  );

  if (!publishRes.ok) {
    const err = await publishRes.json().catch(() => ({}));
    throw new Error(`Instagram publish error ${publishRes.status}: ${JSON.stringify(err)}`);
  }

  const data = await publishRes.json();
  return {
    success: true,
    postId: data.id,
    postUrl: `https://instagram.com/p/${data.id}`,
  };
}
