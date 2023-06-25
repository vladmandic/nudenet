const { exec } = require("child_process");
const fs = require("fs");
var dedup=(path)=>{
  fs.readdir(`./${path}`,"utf8", function (err, files) {
  
  if(!err){
    for (let i = 0; i < files.length; i++) {
      var chem =`${path}/${files[i]}`
      var temp = fs.readFileSync(chem).toString()
      for (let i = 0; i < files.length; i++) {
        var chem2 = `${path}/${files[i]}`
        var temp2 = fs.readFileSync(chem2).toString()
        if (chem != chem2) {
          if (temp === temp2) {
            fs.unlinkSync(chem2);files.splice(i, 1);console.log(`${files[i]} is duplicated`)
          }
          
        }
        
      }
  
    }
  }
 
})}
function analyze(dir) {
  console.time(dir);
  const array = fs.readdirSync(dir);
  const resultFiles = fs.readdirSync("..\\result");
  const maxIndex = maxin(resultFiles,array);
  let currentIndex = maxIndex;
    console.log(currentIndex)
    console.log(array.length)
  const runNextCommand = () => {
    if (currentIndex >= array.length) {
      console.timeEnd(dir);
      console.log(`${array.length - resultFiles.length} commandes ont été exécutées`);
      ("..\\result");
      return;
    }
    console.log(currentIndex)
    const element = array[currentIndex];
    const output = `..\\result\\${element}`;
    if(!fs.existsSync(output)){
        const command = `node src\\nudenet.js -i="${dir + "\\" + element}" -o="${output}"`;
        console.log(100 -(((array.length-currentIndex)/array.length)*100))
        console.log(element)
        exec(command, (error, stdout, stderr) => {
          if (error) {
            console.error(`exec error: ${error}`);
        
          }
          console.log(`stdout: ${stdout}`);
          console.error(`stderr: ${stderr}`);
          currentIndex++;
          runNextCommand();
        });
    }else{
        currentIndex++;
        runNextCommand(); 
    }
   
  }

  runNextCommand();
}

function maxin(array,filelist ) {
    if ( filelist.indexOf(array[array.length-1])==-1){
        return 0
    }
  return  filelist.indexOf(array[array.length-1])
}

function protect(str) {
  return str.replace(/ /g, "\\ ");
}

analyze("d:\\perso\\img-test\\image\\cosplay");// replace with your storage path 
