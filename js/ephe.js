

function ephe() {
        console.log(dateDayMonth());
        date = new Date;
        
        fs.createReadStream(pathSEE+"ephe.csv")
            .pipe(csv())
            .on('data', (row) => {
                //On recup la ligne avec la date du jour
                if (dateDayMonth() === row[0]) {
                        console.log(row[1])
                    if(row[1]== "2"){
                       // TxtEphe = "Saint "+ row[2] +", bonne fête aux "+ row[2] +""
                        TxtEphe = "Saint "+ row[2]
                    }
                    else if(row[1]== "3"){
                        //TxtEphe = "Sainte "+ row[2] +", bonne fête aux "+ row[2] +""
                        TxtEphe = "Sainte "+ row[2]
                    }          
                }
            })
            .on('end', () => {        
                
    document.getElementById('ephe').innerHTML = TxtEphe;
    
            });


}
