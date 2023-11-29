    //Affichage Meteo

    function format_time(s) {
      return new Date(s * 1e3).toISOString().slice(-13, -5);
    }


    const getMeteo = async () => {
        try {
          // return await axios.get('http://api.openweathermap.org/data/2.5/weather?id=3037423&units=metric&appid=82899d0af42ee5a7d6f568c951af2178')48.75, 2.3]
          return await axios.get('https://api.openweathermap.org/data/2.5/onecall?lat=48.75&lon=2.3&units=metric&exclude=hourly,minutely&appid=82899d0af42ee5a7d6f568c951af2178')
        } catch (error) {
          console.error(error)
        }
      }
  
      const requestJsonMeteo = async () => {
        const JsonMeteo = await getMeteo()
        console.log(JsonMeteo)
        if (JsonMeteo) {
          document.getElementById('todayTemp').innerHTML = Math.round(JsonMeteo.data.current.temp) + " °C"
          document.getElementById('todayImgMeteo').src = "logo/meteo/" + JsonMeteo.data.current.weather[0].icon + ".png"
          document.getElementById('todaySunRise').innerHTML = format_time(JsonMeteo.data.current.sunrise)
          document.getElementById('todaySunSet').innerHTML = format_time(JsonMeteo.data.current.sunset)
          //document.getElementById('todayImgMeteo').src = "http://openweathermap.org/img/wn/" + JsonMeteo.data.current.weather[0].icon + "@2x.png"
          for (let i = 1; i <= 4; i++) {
            document.getElementById('Tempd+' + i).innerHTML = Math.round(JsonMeteo.data.daily[i].temp.eve) + " °C"
           // document.getElementById('ImgMeteod+' + i).src = "http://openweathermap.org/img/wn/" + JsonMeteo.data.daily[i].weather[0].icon + "@2x.png"
            document.getElementById('ImgMeteod+' + i).src = "logo/meteo/" +  JsonMeteo.data.daily[i].weather[0].icon + ".png"
           document.getElementById('SunSet+' + i).innerHTML = format_time(JsonMeteo.data.daily[i].sunset)
           document.getElementById('SunRise+' + i).innerHTML = format_time(JsonMeteo.data.daily[i].sunrise)
            if (i > 1) {
              document.getElementById('dateJourd+' + i).innerHTML = jourFr(JsonMeteo.data.daily[i].dt)
            }
  
          }
        }
      }



          //Affichage Actu
    const getActuFr = async () => {
      try {
        // return await axios.get('http://api.openweathermap.org/data/2.5/weather?id=3037423&units=metric&appid=82899d0af42ee5a7d6f568c951af2178')48.75, 2.3]
        return await axios.get('http://api.mediastack.com/v1/news?access_key=d2e09c40e23ad03e4ee567450431184a&categories=business&countries=fr')
      } catch (error) {
        console.error(error)
      }
    }
/*
    const requestJsonActuFr = async () => {
      const JsonActu = await getActuFr()
      console.log(JsonActu)
      if (JsonActu) {
        console.log("drt")
        console.log(JsonActu.data.data[0])
        console.log(JsonActu.data.data[0].description)
        document.getElementById('actuP').innerHTML = JsonActu.data.data[0].description
        document.getElementById('actuT').innerHTML = JsonActu.data.data[0].title
        document.getElementById('actuSource').innerHTML = 'Publié le :'+ JsonActu.data.data[0].published_at + ' par ' + JsonActu.data.data[0].source
        document.getElementById('actuImg').src = JsonActu.data.data[0].image
      }
    }*/

      