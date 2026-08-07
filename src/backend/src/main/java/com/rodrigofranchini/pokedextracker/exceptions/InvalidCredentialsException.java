package com.rodrigofranchini.pokedextracker.exceptions;

// Thrown for both an unknown email and a wrong password.
public class InvalidCredentialsException extends RuntimeException {

    public InvalidCredentialsException(String message) {
        super(message);
    }
}
