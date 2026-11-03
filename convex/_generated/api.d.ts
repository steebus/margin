/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as art from "../art.js";
import type * as artNode from "../artNode.js";
import type * as auth from "../auth.js";
import type * as books from "../books.js";
import type * as buddy from "../buddy.js";
import type * as buddyNode from "../buddyNode.js";
import type * as capture from "../capture.js";
import type * as crons from "../crons.js";
import type * as entries from "../entries.js";
import type * as guideNode from "../guideNode.js";
import type * as guides from "../guides.js";
import type * as hardcover from "../hardcover.js";
import type * as http from "../http.js";
import type * as lib_artFrame from "../lib/artFrame.js";
import type * as lib_artPrompt from "../lib/artPrompt.js";
import type * as lib_books from "../lib/books.js";
import type * as lib_buddy from "../lib/buddy.js";
import type * as lib_entryKey from "../lib/entryKey.js";
import type * as lib_gemini from "../lib/gemini.js";
import type * as lib_guide from "../lib/guide.js";
import type * as lib_hardcover from "../lib/hardcover.js";
import type * as lib_milestones from "../lib/milestones.js";
import type * as lib_nudge from "../lib/nudge.js";
import type * as lib_outbox from "../lib/outbox.js";
import type * as lib_redirects from "../lib/redirects.js";
import type * as lib_reflection from "../lib/reflection.js";
import type * as lib_shareRead from "../lib/shareRead.js";
import type * as lib_transcript from "../lib/transcript.js";
import type * as library from "../library.js";
import type * as milestones from "../milestones.js";
import type * as push from "../push.js";
import type * as pushNode from "../pushNode.js";
import type * as reflect from "../reflect.js";
import type * as share from "../share.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  art: typeof art;
  artNode: typeof artNode;
  auth: typeof auth;
  books: typeof books;
  buddy: typeof buddy;
  buddyNode: typeof buddyNode;
  capture: typeof capture;
  crons: typeof crons;
  entries: typeof entries;
  guideNode: typeof guideNode;
  guides: typeof guides;
  hardcover: typeof hardcover;
  http: typeof http;
  "lib/artFrame": typeof lib_artFrame;
  "lib/artPrompt": typeof lib_artPrompt;
  "lib/books": typeof lib_books;
  "lib/buddy": typeof lib_buddy;
  "lib/entryKey": typeof lib_entryKey;
  "lib/gemini": typeof lib_gemini;
  "lib/guide": typeof lib_guide;
  "lib/hardcover": typeof lib_hardcover;
  "lib/milestones": typeof lib_milestones;
  "lib/nudge": typeof lib_nudge;
  "lib/outbox": typeof lib_outbox;
  "lib/redirects": typeof lib_redirects;
  "lib/reflection": typeof lib_reflection;
  "lib/shareRead": typeof lib_shareRead;
  "lib/transcript": typeof lib_transcript;
  library: typeof library;
  milestones: typeof milestones;
  push: typeof push;
  pushNode: typeof pushNode;
  reflect: typeof reflect;
  share: typeof share;
  users: typeof users;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
