const SUPPORTED = ['New Delhi','Mumbai','Hyderabad','Bengaluru','Chennai','Kolkata','Vijayawada'];
const normalize = value => String(value ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
const aliases = {newdelhi:['newdelhi','delhi'],bengaluru:['bengaluru','bangalore'],mumbai:['mumbai','bombay'],kolkata:['kolkata','calcutta'],chennai:['chennai','madras']};
function rows(body) {
  if (Array.isArray(body)) return body;
  for (const key of ['data','results','prices','result']) if (Array.isArray(body?.[key])) return body[key];
  return [];
}
async function fetchFuel(type,key) {
  const url = new URL('https://fuel.indianapi.in/live_fuel_price');
  url.searchParams.set('fuel_type',type);
  url.searchParams.set('location_type','city');
  const response = await fetch(url,{headers:{'x-api-key':key,'accept':'application/json'}});
  if (!response.ok) throw new Error(`Fuel API HTTP ${response.status} for ${type}`);
  return rows(await response.json());
}
function getRate(list,city) {
  const names = aliases[normalize(city)] || [normalize(city)];
  const row = list.find(item=>names.includes(normalize(item?.city ?? item?.name ?? item?.location)));
  const value = Number(String(row?.price ?? '').replace(/,/g,''));
  return row && Number.isFinite(value) && value > 0 ? {price:value,change:row.change ?? null,updatedAt:row.updated_at ?? row.updatedAt ?? null} : null;
}
export default async function handler(req,res) {
  res.setHeader('Cache-Control','s-maxage=300, stale-while-revalidate=300');
  if(req.method!=='GET') return res.status(405).json({status:'error',message:'GET only'});
  const city=SUPPORTED.find(x=>normalize(x)===normalize(req.query.city || 'Hyderabad'));
  if(!city) return res.status(400).json({status:'error',message:'Unsupported city'});
  const key=process.env.FUEL_API_KEY;
  if(!key) return res.status(200).json({status:'not_configured',city,petrol:null,diesel:null});
  try {
    const [p,d]=await Promise.all([fetchFuel('petrol',key),fetchFuel('diesel',key)]);
    const petrol=getRate(p,city),diesel=getRate(d,city);
    if(!petrol || !diesel) return res.status(502).json({status:'unavailable',city,message:'No valid city prices returned',petrol:null,diesel:null});
    return res.status(200).json({status:'live',source:'Indian API',city,petrol:petrol.price,diesel:diesel.price,unit:'INR per litre',updatedAt:petrol.updatedAt || diesel.updatedAt || null});
  } catch(e) {
    console.error('Fuel API error:',e.message);
    return res.status(502).json({status:'unavailable',city,message:'Fuel provider unavailable',petrol:null,diesel:null});
  }
}