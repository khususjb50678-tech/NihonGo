const reg=document.getElementById("registerForm"), login=document.getElementById("loginForm");
reg?.addEventListener("submit",e=>{e.preventDefault();localStorage.setItem("bn_user",JSON.stringify({name:document.getElementById("name").value,email:document.getElementById("email").value}));location.href="index.html";});
login?.addEventListener("submit",e=>{e.preventDefault();const email=document.getElementById("email").value;localStorage.setItem("bn_user",JSON.stringify({name:email.split("@")[0],email}));location.href="index.html";});
