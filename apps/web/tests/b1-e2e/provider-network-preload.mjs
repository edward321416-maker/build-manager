// Test child process only. Never imported by the production graph/start command.
const original=globalThis.fetch;
globalThis.fetch=async function(input,init){
 const url=new URL(input instanceof Request?input.url:String(input));
 if(url.hostname==='b1.synthetic.invalid'){
  if(url.pathname==='/.well-known/openid-configuration')return Response.json({issuer:'https://b1.synthetic.invalid/',authorization_endpoint:'https://b1.synthetic.invalid/authorize',token_endpoint:'https://b1.synthetic.invalid/oauth/token',jwks_uri:'https://b1.synthetic.invalid/.well-known/jwks.json',end_session_endpoint:process.env.B1_E2E_PROVIDER_ORIGIN+'/logout',response_types_supported:['code'],subject_types_supported:['public'],id_token_signing_alg_values_supported:['RS256']});
  throw new Error('UNEXPECTED_SYNTHETIC_PROVIDER_REQUEST');
 }
 if(url.hostname!=='localhost'&&url.hostname!=='127.0.0.1')throw new Error('EXTERNAL_PROVIDER_REQUEST_FORBIDDEN_IN_E2E');
 return original(input,init);
};
