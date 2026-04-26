/**
 * Compatibility export for the source-outline command.
 *
 * The implementation lives in `src/lib/source-outline.ts` so registry code can
 * dispatch it without importing back into the commands layer.
 */

export {
	EXIT_CODES,
	runSourceOutline,
	runSourceOutlineCLI,
	type SourceOutlineImplementation,
	type SourceOutlineMode,
	type SourceOutlineOptions,
	type SourceOutlineOutput,
	type SourceOutlineSymbol,
	type SourceSymbolKind,
} from "../lib/source-outline.js";
