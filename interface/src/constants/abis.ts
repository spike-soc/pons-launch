import { parseAbi } from 'viem';

export const factoryAbi = parseAbi([
  'struct LaunchConfig { uint256 supply; uint256 curveFeeBps; uint256 phantomQuote; uint256 graduationThreshold; uint24 poolFee; int24 tickSpacing; bool enabled; }',
  'struct LaunchedToken { address token; address curve; address deployer; address creatorFeeRecipient; address pairToken; uint256 graduationThreshold; uint24 poolFee; int24 tickSpacing; uint16 creatorTaxBps; bool buybackEnabled; uint8 phase; uint256 sweptQuote; uint256 sweptTokens; uint256 sweptAt; bool exists; }',
  'function launchConfigCount() view returns (uint256)',
  'function getLaunchConfig(uint256 id) view returns (LaunchConfig)',
  'function getLaunchedToken(address token) view returns (LaunchedToken)',
  'function launchFee() view returns (uint256)',
  'function previewLaunchEconomics(uint256 launchConfigId, address pairToken) view returns (bytes32)',
  'function maxCreatorTaxBps() view returns (uint256)',
  'function canLaunch(address account) view returns (bool)',
  'function approvedPairTokens(address pairToken) view returns (bool)'
]);

/** Nested structs + factory launchToken with snipe exemptions. */
export const launchTokenWriteAbi = parseAbi([
  'struct Socials { string twitter; string telegram; string discord; string website; string farcaster; }',
  'struct TokenParams { string name; string symbol; string logo; string description; Socials socials; address creatorFeeRecipient; uint16 creatorTaxBps; bool buybackEnabled; bytes32 expectedEconomics; bytes32 salt; }',
  'function launchToken(TokenParams params, uint256 launchConfigId, address pairToken, address[] snipeTaxExemptions) payable returns (address token, address curve)'
]);

/** Launch-and-buy router (atomic create + first buy). */
export const launchAndBuyAbi = parseAbi([
  'struct Socials { string twitter; string telegram; string discord; string website; string farcaster; }',
  'struct TokenParams { string name; string symbol; string logo; string description; Socials socials; address creatorFeeRecipient; uint16 creatorTaxBps; bool buybackEnabled; bytes32 expectedEconomics; bytes32 salt; }',
  'function launchAndBuy(TokenParams params, uint256 launchConfigId, address pairToken, uint256 quoteIn, uint256 minTokensOut, address recipient, address[] snipeTaxExemptions) payable returns (address token, address curve, uint256 tokensOut)'
]);

export const curveAbi = parseAbi([
  'function getReserves() view returns (uint256 quoteReserve, uint256 tokenReserve)',
  'function realQuoteReserve() view returns (uint256)',
  'function sellableTokens() view returns (uint256)',
  'function feeBps() view returns (uint256)',
  'function creatorTaxBps() view returns (uint256)',
  'function currentSnipeTaxBps(address recipient) view returns (uint256)',
  'function graduationThreshold() view returns (uint256)',
  'function readyToGraduate() view returns (bool)',
  'function graduated() view returns (bool)',
  'function isNativeQuote() view returns (bool)',
  'function pairToken() view returns (address)',
  'function buy(uint256 quoteIn, uint256 minTokensOut, address recipient) payable returns (uint256 tokensOut)'
]);

export const launcherTokenAbi = parseAbi([
  'struct Socials { string twitter; string telegram; string discord; string website; string farcaster; }',
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function getTokenInfo() view returns (address tokenDeployer, string tokenLogo, string tokenDescription, Socials tokenSocials)'
]);

export type SocialsParams = {
  twitter: string;
  telegram: string;
  discord: string;
  website: string;
  farcaster: string;
};

export type TokenParamsInput = {
  name: string;
  symbol: string;
  logo: string;
  description: string;
  socials: SocialsParams;
  creatorFeeRecipient: `0x${string}`;
  creatorTaxBps: number;
  buybackEnabled: boolean;
  expectedEconomics: `0x${string}`;
  salt: `0x${string}`;
};
