#!/usr/bin/env python3
"""
Get a post with comments
Usage: python3 scripts/get_post.py POST_ID --comments 20
"""
import argparse
import json
from reddit_api import api_get, clean_post, print_post, print_comments_list, RedditBlocked, print_fallback


def main():
    parser = argparse.ArgumentParser(description="Get Reddit post with comments")
    parser.add_argument("post_id", help="Post ID (e.g., abc123)")
    parser.add_argument("--comments", "-c", type=int, default=20, help="Max comments")
    parser.add_argument("--json", "-j", action="store_true", help="Output as JSON")
    args = parser.parse_args()

    try:
        data = api_get(f"comments/{args.post_id}", {"limit": args.comments})

        if not isinstance(data, list) or len(data) < 2:
            print(f"Post not found: {args.post_id}")
            return

        if args.json:
            print(json.dumps(data, indent=2))
            return

        post_listing = data[0].get("data", {}).get("children", [])
        if post_listing:
            post = clean_post(post_listing[0])
            print_post(post)

        comments_listing = data[1].get("data", {}).get("children", [])
        if comments_listing:
            print(f"---")
            print_comments_list(comments_listing[:args.comments])
    except RedditBlocked:
        print_fallback("post_detail", f"reddit post {args.post_id} comments")


if __name__ == "__main__":
    main()
