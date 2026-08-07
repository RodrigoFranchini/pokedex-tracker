package com.rodrigofranchini.pokedextracker.controllers;

import com.rodrigofranchini.pokedextracker.config.AuthCookieFactory;
import com.rodrigofranchini.pokedextracker.dtos.LoginRequest;
import com.rodrigofranchini.pokedextracker.dtos.RegisterRequest;
import com.rodrigofranchini.pokedextracker.dtos.UserResponse;
import com.rodrigofranchini.pokedextracker.entities.User;
import com.rodrigofranchini.pokedextracker.services.JwtService;
import com.rodrigofranchini.pokedextracker.services.UserService;
import jakarta.validation.Valid;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth")
public class AuthController {
    private final UserService userService;
    private final JwtService jwtService;
    private final AuthCookieFactory authCookieFactory;

    public AuthController(UserService userService, JwtService jwtService, AuthCookieFactory authCookieFactory) {
        this.userService = userService;
        this.jwtService = jwtService;
        this.authCookieFactory = authCookieFactory;
    }

    // POST => Register
    @PostMapping("/register")
    public ResponseEntity<UserResponse> register(@Valid @RequestBody RegisterRequest request){
        User user = userService.register(request.email(),  request.password());
        return signedIn(user, HttpStatus.CREATED);
    }

    // POST => Login
    @PostMapping("/login")
    public ResponseEntity<UserResponse> login(@Valid @RequestBody LoginRequest request){
        User user = userService.authenticate(request.email(), request.password());
        return signedIn(user, HttpStatus.OK);
    }

    // POST => Logout
    @PostMapping("/logout")
    public ResponseEntity<Void> logout(){
        // Nothing server-side to invalidate, so signing out is the browser
        // being told to drop the cookie.
        return ResponseEntity.noContent()
                .header(HttpHeaders.SET_COOKIE, authCookieFactory.clear().toString())
                .build();
    }

    // Sign in => Login and register
    private ResponseEntity<UserResponse> signedIn(User user, HttpStatus status){
        String token = jwtService.generateToken(user);
        return ResponseEntity.status(status)
                .header(HttpHeaders.SET_COOKIE, authCookieFactory.create(token).toString())
                .body(UserResponse.from(user));
    }
}
