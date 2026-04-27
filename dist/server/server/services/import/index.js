// Unified re-exports for the import service module
export { parseGitHubUrl, parseGiteeUrl, parseGitLabUrl, parseClawHubUrl, parseBitbucketUrl, } from './urlParsers.js';
export { githubApiFetch, getGitHubRepoInfo, downloadRepoAsZip, giteeApiFetch, getGiteeRepoInfo, gitlabApiFetch, getGitLabRepoInfo, bitbucketApiFetch, getBitbucketRepoInfo, downloadBitbucketContents, } from './gitApis.js';
export { registerImportProvider, getImportProviders, detectProvider, } from './providerRegistry.js';
