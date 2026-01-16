export const theme = {
  colors: {
    // Core Backgrounds (Dark Onyx for that "Rainbow" depth)
    background: '#676060ff',       
    backgroundDark: '#121212ff',   
    backgroundMain: '#676060ff', 
    backgroundSecondary: '#1c1c1eff', 
    
    // Text (High Contrast)
    text: '#ffffffff',             
    textLight: '#000000ff',      
    textWhite: '#ffffffff',        
    
    // Borders & Accents
    border: '#27272aff',         
    borderLight: 'rgba(255, 255, 255, 0.08)', 
    accent: '#0d9488',           
    
    // Balance card & Leaderboard highlights
    cardGradientFrom: '#06210fff', 
    cardGradientTo: '#011a0122',  
    cardText: '#ffffff',
    cardTextSecondary: 'rgba(255, 255, 255, 0.6)',
    cardButton: '#0d9488',
    cardButtonHover: 'rgba(255, 255, 255, 0.1)',
    cardButtonBorder: 'rgba(255, 255, 255, 0.1)',

    clickButtonBorder: 'rgba(13, 148, 136, 0.5)',
  }
} as const;