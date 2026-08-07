package com.rodrigofranchini.pokedextracker.exceptions;

// Thrown for a (game, dex) pair the server does not recognise.
public class UnknownDexException extends RuntimeException {

    public UnknownDexException(String message) {
        super(message);
    }
}
