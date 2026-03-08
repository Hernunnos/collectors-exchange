console.log('Script started')

const { createClient } = await import('@supabase/supabase-js')

const supabase = createClient(
  'https://aqtcewdowqzutqdgbwui.supabase.com',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFxdGNld2Rvd3F6dXRxZGdid3VpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI5ODY2OTEsImV4cCI6MjA4ODU2MjY5MX0.xf0mKOuOCwiwXRcpPE517uHIMdHpJpFZcsiJS-LhwGU'
)

function sleep(ms){ return new Promise(r=>setTimeout(r,ms)) }

async function insertBatch(cards){
  const { error } = await supabase.from('cards').insert(cards)
  if(error) console.error('Insert error:', error.message)
  else console.log(`  ✓ Inserted ${cards.length} cards`)
}

async function importPokemon(){
  console.log('\n🟡 Importing Pokémon...')
  let page = 1, imported = 0
  while(true){
    const res = await fetch(`https://api.pokemontcg.io/v2/cards?page=${page}&pageSize=250&select=name,set,rarity,images,tcgplayer`, {
      headers: { 'X-Api-Key': 'd3e4b946-5576-4de5-8554-cdbefd4429fb' }
    })
    const json = await res.json()
    if(!json.data?.length) break
    const cards = json.data
      .filter(c => c.images?.large)
      .map(c => ({
        name: c.name,
        set_name: c.set?.name || 'Unknown',
        condition: 'NM',
        rarity: c.rarity || 'Common',
        game: 'Pokémon',
        base_price: c.tcgplayer?.prices?.holofoil?.market || c.tcgplayer?.prices?.normal?.market || 1.00,
        img_url: c.images.large,
        language: 'English'
      }))
    await insertBatch(cards)
    imported += cards.length
    console.log(`  Page ${page} done (${imported} total)`)
    page++
    await sleep(300)
    if(json.data.length < 250) break
  }
  console.log(`✅ Pokémon done — ${imported} cards`)
}

async function importYugioh(){
  console.log('\n🔴 Importing Yu-Gi-Oh...')
  const res = await fetch('https://db.ygoprodeck.com/api/v7/cardinfo.php')
  const json = await res.json()
  const cards = json.data.filter(c => c.card_images?.[0]?.image_url)
  console.log(`  ${cards.length} cards to import`)
  for(let i = 0; i < cards.length; i += 100){
    const batch = cards.slice(i, i+100).map(c => ({
      name: c.name,
      set_name: c.card_sets?.[0]?.set_name || 'Core Set',
      condition: 'NM',
      rarity: c.card_sets?.[0]?.set_rarity || 'Common',
      game: 'Yu-Gi-Oh',
      base_price: c.card_prices?.[0]?.tcgplayer_price ? parseFloat(c.card_prices[0].tcgplayer_price) : 0.50,
      img_url: c.card_images[0].image_url,
      language: 'English'
    }))
    await insertBatch(batch)
    await sleep(100)
  }
  console.log(`✅ Yu-Gi-Oh done`)
}

async function importMTG(){
  console.log('\n🔵 Importing MTG...')
  const res = await fetch('https://api.scryfall.com/bulk-data')
  const bulk = await res.json()
  const oracleEntry = bulk.data.find(d => d.type === 'oracle_cards')
  console.log('  Downloading bulk data...')
  const cardsRes = await fetch(oracleEntry.download_uri)
  const cards = await cardsRes.json()
  const filtered = cards.filter(c => c.image_uris?.large && !c.digital)
  console.log(`  ${filtered.length} cards to import`)
  for(let i = 0; i < filtered.length; i += 100){
    const batch = filtered.slice(i, i+100).map(c => ({
      name: c.name,
      set_name: c.set_name,
      condition: 'NM',
      rarity: c.rarity.charAt(0).toUpperCase() + c.rarity.slice(1),
      game: 'MTG',
      base_price: c.prices?.usd ? parseFloat(c.prices.usd) : 0.50,
      img_url: c.image_uris.large,
      language: 'English'
    }))
    await insertBatch(batch)
    await sleep(100)
  }
  console.log(`✅ MTG done`)
}

console.log('🚀 Starting import...')
await importPokemon()
await importMTG()
await importYugioh()
console.log('\n🎉 All done!')