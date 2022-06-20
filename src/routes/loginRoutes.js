const login = require('../controllers/userControllers.js').login;

const loginRoutes = (app) => {
    app.route('/auth/login')
        .post(login);
}

module.exports = {loginRoutes};
