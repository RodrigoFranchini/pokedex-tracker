package com.rodrigofranchini.pokedextracker.services;

import com.rodrigofranchini.pokedextracker.entities.User;

public interface UserService {

    User register(String email, String password);

}
