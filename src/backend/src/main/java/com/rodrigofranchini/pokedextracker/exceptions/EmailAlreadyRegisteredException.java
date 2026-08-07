package com.rodrigofranchini.pokedextracker.exceptions;

/**
 * Thrown when registration is attempted with an address that already has an
 * account.
 *
 * Deliberately a plain RuntimeException carrying no HTTP concepts -- the
 * service must stay callable from a test or a CLI, so mapping this to a 409 is
 * the controller's job. Unchecked so that @Transactional rolls back on it.
 */
public class EmailAlreadyRegisteredException extends RuntimeException {

    public EmailAlreadyRegisteredException(String message) {
        super(message);
    }
}
