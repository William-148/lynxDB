import { OrderDetail } from "../types/order-test.type";
import { User } from "../types/user-test.type";

export const defaultUser: User = Object.freeze({
  id: 1,
  fullName: 'John Doe',
  gender: "Male",
  age: 25,
  email: 'john@gmail.com',
  username: 'john23_11',
  password: '123456'
});
/**
 * List of 30 users.
 * The users id are from 1 to 30.
 */
export const thirtyItemsUserList: User[] = [{
  "id": 1,
  "fullName": "Wiley Woller",
  "gender": "Male",
  "age": 45,
  "email": "wwoller0@51.la",
  "username": "wwoller0",
  "password": "sB1$H\\\\V"
}, {
  "id": 2,
  "fullName": "Griswold Ames",
  "gender": "Male",
  "age": 97,
  "email": "games1@amazon.de",
  "username": "games1",
  "password": "tW0`oz?r&@rjk"
}, {
  "id": 3,
  "fullName": "Charlotta Winfindale",
  "gender": "Female",
  "age": 83,
  "email": "cwinfindale2@canalblog.com",
  "username": "cwinfindale2",
  "password": "sG9\"`#\\s2Ej1V"
}, {
  "id": 4,
  "fullName": "Devland Whale",
  "gender": "Male",
  "age": 50,
  "email": "dwhale3@google.co.uk",
  "username": "dwhale3",
  "password": "yC2?sO$4+A"
}, {
  "id": 5,
  "fullName": "Alwyn Warlton",
  "gender": "Male",
  "age": 38,
  "email": "awarlton4@xing.com",
  "username": "awarlton4",
  "password": "tP7%3%o>NJ$FI"
}, {
  "id": 6,
  "fullName": "Trenna Newling",
  "gender": "Female",
  "age": 81,
  "email": "tnewling5@webs.com",
  "username": "tnewling5",
  "password": "eQ7#!l\"02R"
}, {
  "id": 7,
  "fullName": "Town Astlet",
  "gender": "Male",
  "age": 44,
  "email": "tastlet6@angelfire.com",
  "username": "tastlet6",
  "password": "eV7+Dud!b"
}, {
  "id": 8,
  "fullName": "Maxy Sworder",
  "gender": "Male",
  "age": 88,
  "email": "msworder7@arstechnica.com",
  "username": "msworder7",
  "password": "dO7(K,r{u"
}, {
  "id": 9,
  "fullName": "Cecile Faulds",
  "gender": "Female",
  "age": 21,
  "email": "cfaulds8@oakley.com",
  "username": "cfaulds8",
  "password": "qL5#iT|SS"
}, {
  "id": 10,
  "fullName": "Deny Thumim",
  "gender": "Female",
  "age": 51,
  "email": "dthumim9@fastcompany.com",
  "username": "dthumim9",
  "password": "jX8>%bc\\_.L#$7Fu"
}, {
  "id": 11,
  "fullName": "Titus Tythacott",
  "gender": "Male",
  "age": 38,
  "email": "ttythacotta@time.com",
  "username": "ttythacotta",
  "password": "cA8'x2RXX%4c8"
}, {
  "id": 12,
  "fullName": "Erin Bromhead",
  "gender": "Male",
  "age": 94,
  "email": "ebromheadb@sina.com.cn",
  "username": "ebromheadb",
  "password": "wK3_P|r<*QU"
}, {
  "id": 13,
  "fullName": "Caresse Hugo",
  "gender": "Female",
  "age": 37,
  "email": "chugoc@slideshare.net",
  "username": "chugoc",
  "password": "cO0_F6'n/GBdezc+"
}, {
  "id": 14,
  "fullName": "Elli Stansbury",
  "gender": "Female",
  "age": 41,
  "email": "estansburyd@sphinn.com",
  "username": "estansburyd",
  "password": "vN3},/=N)wci4$T"
}, {
  "id": 15,
  "fullName": "Conny Eric",
  "gender": "Female",
  "age": 41,
  "email": "cerice@shinystat.com",
  "username": "cerice",
  "password": "fL8`f(!XN"
}, {
  "id": 16,
  "fullName": "Hubie Gethyn",
  "gender": "Male",
  "age": 12,
  "email": "hgethynf@businessweek.com",
  "username": "hgethynf",
  "password": "dU4~mog}tDq*m38"
}, {
  "id": 17,
  "fullName": "Jordan Burwin",
  "gender": "Female",
  "age": 25,
  "email": "jburwing@github.com",
  "username": "jburwing",
  "password": "aQ3>st@(9n=<`AZ"
}, {
  "id": 18,
  "fullName": "Cris Cotgrove",
  "gender": "Female",
  "age": 81,
  "email": "ccotgroveh@youku.com",
  "username": "ccotgroveh",
  "password": "dF2(p,osHb#nqcg"
}, {
  "id": 19,
  "fullName": "Caril Elrick",
  "gender": "Female",
  "age": 94,
  "email": "celricki@yale.edu",
  "username": "celricki",
  "password": "rQ5?asnsP|u&"
}, {
  "id": 20,
  "fullName": "Yolanthe Broomhead",
  "gender": "Female",
  "age": 16,
  "email": "ybroomheadj@usnews.com",
  "username": "ybroomheadj",
  "password": "yU1'|7?W"
}, {
  "id": 21,
  "fullName": "Mick Devonish",
  "gender": "Male",
  "age": 41,
  "email": "mdevonishk@biglobe.ne.jp",
  "username": "mdevonishk",
  "password": "tX3#SxUfxJ)W&0`/"
}, {
  "id": 22,
  "fullName": "Salome Kett",
  "gender": "Female",
  "age": 75,
  "email": "skettl@yellowbook.com",
  "username": "skettl",
  "password": "sO3!rR0.s"
}, {
  "id": 23,
  "fullName": "Stillman Kermath",
  "gender": "Male",
  "age": 42,
  "email": "skermathm@flickr.com",
  "username": "skermathm",
  "password": "tF1'#q0>5fi"
}, {
  "id": 24,
  "fullName": "Iggy Von Gladbach",
  "gender": "Male",
  "age": 34,
  "email": "ivonn@miitbeian.gov.cn",
  "username": "ivonn",
  "password": "kR3.2PRCXa"
}, {
  "id": 25,
  "fullName": "Blakelee Luscombe",
  "gender": "Female",
  "age": 25,
  "email": "bluscombeo@google.com.br",
  "username": "bluscombeo",
  "password": "vH1`LIbx5'D|"
}, {
  "id": 26,
  "fullName": "Margaretta Ferreres",
  "gender": "Female",
  "age": 83,
  "email": "mferreresp@github.com",
  "username": "mferreresp",
  "password": "cR9&h~o?0T"
}, {
  "id": 27,
  "fullName": "Kingsly Antushev",
  "gender": "Male",
  "age": 51,
  "email": "kantushevq@ed.gov",
  "username": "kantushevq",
  "password": "fB4!b!DreB6}fuQ"
}, {
  "id": 28,
  "fullName": "Sven Drennan",
  "gender": "Male",
  "age": 67,
  "email": "sdrennanr@rambler.ru",
  "username": "sdrennanr",
  "password": "dX1*Gd!oxg"
}, {
  "id": 29,
  "fullName": "Korey Houtby",
  "gender": "Male",
  "age": 59,
  "email": "khoutbys@opera.com",
  "username": "khoutbys",
  "password": "hN1$RfSQl5*/so"
}, {
  "id": 30,
  "fullName": "Andeee Boys",
  "gender": "Female",
  "age": 31,
  "email": "aboyst@wikimedia.org",
  "username": "aboyst",
  "password": "mP8=Dx6A$yp#"
}]

export const twentyOrderDetails: OrderDetail[] = [
  { orderId: 1, productId: 1, quantity: 2, price: 100 },
  { orderId: 1, productId: 2, quantity: 1, price:  50 },
  { orderId: 2, productId: 1, quantity: 1, price: 100 },
  { orderId: 2, productId: 3, quantity: 4, price: 200 },
  { orderId: 3, productId: 1, quantity: 3, price: 150 },
  { orderId: 3, productId: 2, quantity: 2, price: 100 },
  { orderId: 3, productId: 3, quantity: 1, price:  50 },
  { orderId: 4, productId: 1, quantity: 5, price: 250 },
  { orderId: 4, productId: 2, quantity: 4, price: 200 },
  { orderId: 4, productId: 3, quantity: 3, price: 150 },
  { orderId: 5, productId: 1, quantity: 2, price: 100 },
  { orderId: 5, productId: 2, quantity: 1, price:  50 },
  { orderId: 5, productId: 3, quantity: 5, price: 250 },
  { orderId: 6, productId: 1, quantity: 4, price: 200 },
  { orderId: 6, productId: 2, quantity: 3, price: 150 },
  { orderId: 6, productId: 3, quantity: 2, price: 100 },
  { orderId: 7, productId: 1, quantity: 1, price:  50 },
  { orderId: 7, productId: 2, quantity: 5, price: 250 },
  { orderId: 7, productId: 3, quantity: 4, price: 200 },
  { orderId: 8, productId: 1, quantity: 3, price: 150 }
];