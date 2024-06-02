import path from "node:path";
import { Conveyer, ESBuild } from "@nesvet/conveyer";


const distDir = "dist";

const common = {
	external: true,
	platform: "node",
	format: "esm",
	sourcemap: true,
	target: "node20"
};


new Conveyer([
	
	new ESBuild({
		title: "index",
		entryPoints: [ "src/index.js" ],
		outfile: path.resolve(distDir, "index.js"),
		...common
	}),
	
	new ESBuild({
		title: "ws",
		entryPoints: [ "src/ws/index.js" ],
		outfile: path.resolve(distDir, "ws.js"),
		...common
	})
	
], {
	initialCleanup: distDir
});
