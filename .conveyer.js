import path from "node:path";
import { Conveyer, ESBuild } from "@nesvet/conveyer";


const { NODE_ENV } = process.env;

const distDir = "dist";


const common = {
	external: true,
	platform: "node",
	format: "esm",
	sourcemap: true,
	target: "node20",
	define: {
		"process.env.NODE_ENV": JSON.stringify(NODE_ENV)
	}
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
