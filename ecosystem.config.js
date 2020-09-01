module.exports = {
	apps : [{
		name: "litentry-ipfs-graphql",
		script: "yarn start",
		env: {
			NODE_ENV: "development",
		},
		env_production: {
			NODE_ENV: "production",
		}
	}]
}
