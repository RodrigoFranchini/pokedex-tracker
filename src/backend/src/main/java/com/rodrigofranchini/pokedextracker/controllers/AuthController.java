package com.rodrigofranchini.pokedextracker.controllers;

import com.rodrigofranchini.pokedextracker.dtos.RegisterRequest;
import com.rodrigofranchini.pokedextracker.dtos.UserResponse;
import com.rodrigofranchini.pokedextracker.entities.User;
import com.rodrigofranchini.pokedextracker.services.UserService;
import jakarta.validation.Valid;
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

    public AuthController(UserService userService) {
        this.userService = userService;
    }

    // POST => Register
    @PostMapping("/register")
    public ResponseEntity<UserResponse> register(@Valid @RequestBody RegisterRequest request){
        User user = userService.register(request.email(),  request.password());
        UserResponse response = UserResponse.from(user);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }
}
