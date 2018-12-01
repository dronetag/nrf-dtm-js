const inquirer = require('inquirer');

inquirer
    .prompt([
    {
        type: 'input',
        name: 'comName',
        message: "Type serial port path: "
    },
    ])
    .then(answer => {
        console.log(answer.comName);
    });