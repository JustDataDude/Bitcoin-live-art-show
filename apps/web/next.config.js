/** @type {import('next').NextConfig} */
const nextConfig = {
	reactStrictMode: true,
	swcMinify: true,
	
	// Bundle size optimization
	experimental: {
		optimizePackageImports: ['@live-art/ui'],
	},
	
	// Webpack optimizations
	webpack: (config, { isServer }) => {
		if (!isServer) {
			// Reduce bundle size by excluding server-only modules
			config.resolve.fallback = {
				...config.resolve.fallback,
				fs: false,
				net: false,
				tls: false,
			};
			
			// Fix MetaMask SDK trying to import React Native modules
			config.resolve.alias = {
				...config.resolve.alias,
				'@react-native-async-storage/async-storage': false,
			};
		}
		
		// Optimize chunk splitting
		config.optimization = {
			...config.optimization,
			splitChunks: {
				chunks: 'all',
				cacheGroups: {
					default: false,
					vendors: false,
					// Separate vendor chunks
					framework: {
						name: 'framework',
						test: /(?<!node_modules.*)[\\/]node_modules[\\/](react|react-dom|scheduler|prop-types|use-subscription)[\\/]/,
						priority: 40,
						enforce: true,
					},
					lib: {
						test: /[\\/]node_modules[\\/]/,
						name(module) {
							const packageName = module.context.match(/[\\/]node_modules[\\/](.*?)([\\/]|$)/)?.[1];
							return `npm.${packageName?.replace('@', '')}`;
						},
						priority: 30,
						minChunks: 1,
						reuseExistingChunk: true,
					},
					commons: {
						name: 'commons',
						minChunks: 2,
						priority: 20,
					},
					shared: {
						name: 'shared',
						minChunks: 2,
						priority: 10,
						reuseExistingChunk: true,
					},
				},
			},
		};
		
		return config;
	},
	
	// Compress output
	compress: true,
	
	// Production optimizations
	productionBrowserSourceMaps: false,
	
	// Image optimization
	images: {
		formats: ['image/avif', 'image/webp'],
	},
	
	// Security headers
	async headers() {
		return [
			{
				source: '/:path*',
				headers: [
					{
						key: 'X-DNS-Prefetch-Control',
						value: 'on'
					},
					{
						key: 'Strict-Transport-Security',
						value: 'max-age=63072000; includeSubDomains; preload'
					},
					{
						key: 'X-Frame-Options',
						value: 'SAMEORIGIN'
					},
					{
						key: 'X-Content-Type-Options',
						value: 'nosniff'
					},
					{
						key: 'X-XSS-Protection',
						value: '1; mode=block'
					},
					{
						key: 'Referrer-Policy',
						value: 'strict-origin-when-cross-origin'
					},
					{
						key: 'Permissions-Policy',
						value: 'camera=(), microphone=(), geolocation=()'
					},
				],
			},
		];
	},
	
	// Redirect HTTP to HTTPS in production
	async redirects() {
		if (process.env.NODE_ENV === 'production') {
			return [
				{
					source: '/:path*',
					has: [
						{
							type: 'header',
							key: 'x-forwarded-proto',
							value: 'http',
						},
					],
					destination: 'https://:path*',
					permanent: true,
				},
			];
		}
		return [];
	},
};

module.exports = nextConfig;
