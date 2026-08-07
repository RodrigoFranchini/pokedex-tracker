package com.rodrigofranchini.pokedextracker.controllers;

import com.rodrigofranchini.pokedextracker.dtos.UserResponse;
import com.rodrigofranchini.pokedextracker.entities.User;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api")
public class UserController {

    // GET => Current user.
    @GetMapping("/me")
    public UserResponse me(@AuthenticationPrincipal User user){
        return UserResponse.from(user);
    }
}
