/*const apiKey = '969b602d4303313e070ba3417c888fdb6f5834a783410b775b99e49d4416';
const apiUrl = `https://api.cryptorank.io/v1/currencies?api_key=${apiKey}`;

console.log(apiUrl)

fetch(apiUrl, {
    method: 'GET',
    headers: {
        'Content-Type': 'application/json'
    }
})
.then(response => response.json())
.then(data => {
    console.log(data);
})
.catch(error => {
    console.error('Error fetching data:', error);
}); */

const searchParam = "crypto"
const amountOfArticles = 15

const gNewsapiKey = '928ff2bfd7e07886724eafe29ae2e372';
const url = `https://gnews.io/api/v4/search?q=${searchParam}&lang=en&country=us&max=${amountOfArticles}&apikey=${gNewsapiKey}`;


console.log(url)


fetch(url)
  .then(response => response.json())
  .then(data => {
    console.log(data);
  })
  .catch(error => {
    console.error('Error:', error);
  });

  

  async function getCryptoNews(search_category, max_articles) {
    const url = `https://gnews.io/api/v4/search?q=crypto&lang=en&country=us&max=10&apikey=${gNewsapiKey}`;
    
    try {
      const response = await fetch(url);
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error fetching news:', error);
      return { error: 'Unable to fetch news at the moment' };
    }
  }


  getCryptoNews()

  