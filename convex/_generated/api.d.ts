/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as auth from "../auth.js";
import type * as crons from "../crons.js";
import type * as entries from "../entries.js";
import type * as hardcover from "../hardcover.js";
import type * as http from "../http.js";
import type * as lib_books from "../lib/books.js";
import type * as lib_entryKey from "../lib/entryKey.js";
import type * as lib_hardcover from "../lib/hardcover.js";
import type * as lib_outbox from "../lib/outbox.js";
import type * as lib_redirects from "../lib/redirects.js";
import type * as library from "../library.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  auth: typeof auth;
  crons: typeof crons;
  entries: typeof entries;
  hardcover: typeof hardcover;
  http: typeof http;
  "lib/books": typeof lib_books;
  "lib/entryKey": typeof lib_entryKey;
  "lib/hardcover": typeof lib_hardcover;
  "lib/outbox": typeof lib_outbox;
  "lib/redirects": typeof lib_redirects;
  library: typeof library;
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
