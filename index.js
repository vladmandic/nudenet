const { exec } = require("child_process");
const fs = require("fs");

function analyze(dir) {
  console.time(dir);
  const array = fs.readdirSync(dir);
  const resultFiles = fs.readdirSync("../result");
  const maxIndex = maxin(resultFiles,array);
  let currentIndex = maxIndex||0;

  const runNextCommand = () => {
    if (currentIndex >= array.length) {
      console.timeEnd(dir);
      console.log(`${array.length - resultFiles.length} commandes ont été exécutées`);
      require("deduplicator-alphaleadershipv1")("../result");
      return;
    }
    console.log(currentIndex)
    const element = array[currentIndex];
    const output = `..\\result\\${element}`;
    const command = `node src\\nudenet.js -i="${dir + "\\" + element}" -o="${output}"`;
    console.log(((array.length-currentIndex)/array.length)*100)
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
  };

  runNextCommand();
}

function maxin(array,filelist ) {
    if ( filelist.indexOf(array[array.length])==-1){
        return 0
    }
  return  filelist.indexOf(array[array.length])
}

function protect(str) {
  return str.replace(/ /g, "\\ ");
}

analyze("d:\\perso\\img-test\\image\\cosplay");
