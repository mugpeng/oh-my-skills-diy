# Medium API Reference

Base URL: `https://api.medium.com/v1`
Auth: `Authorization: Bearer <token>`

## Endpoints

### GET /me
Get authenticated user info.
Response: `{ data: { id, name, username, url, imageUrl } }`

### POST /users/:userId/posts
Create a post on user's profile.

### POST /publications/:publicationId/posts
Create a post in a publication.

### GET /users/:userId/publications
List publications the user can contribute to.

## Post Payload

| Field | Required | Type | Description |
|-------|----------|------|-------------|
| title | Yes | string | Post title |
| contentFormat | Yes | string | `"markdown"` or `"html"` |
| content | Yes | string | Post body |
| publishStatus | No | string | `"public"`, `"draft"`, or `"unlisted"` (default: `"public"`) |
| tags | No | string[] | Max 3 tags, each max 25 chars |
| canonicalUrl | No | string | Original URL if cross-posting |
| notifyFollowers | No | boolean | Notify followers of new post |

## Limitations

- **No update**: Cannot edit posts after creation via API
- **No delete**: Cannot delete posts via API
- **No list posts**: Cannot list user's posts via API
- **Tags**: Max 3, each max 25 characters
- **Rate limit**: 1000 requests per hour
- **Content**: Markdown supported natively (no HTML conversion needed)

## Cross-Posting

When republishing from your blog:
1. Publish on your blog first (canonical source)
2. Wait 1-2 days for Google to index
3. Set `canonicalUrl` to your blog URL when creating on Medium
