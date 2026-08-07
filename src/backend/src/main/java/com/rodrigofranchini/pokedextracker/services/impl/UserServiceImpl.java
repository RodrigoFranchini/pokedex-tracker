package com.rodrigofranchini.pokedextracker.services.impl;

import com.rodrigofranchini.pokedextracker.entities.User;
import com.rodrigofranchini.pokedextracker.exceptions.EmailAlreadyRegisteredException;
import com.rodrigofranchini.pokedextracker.repositories.UserRepository;
import com.rodrigofranchini.pokedextracker.services.UserService;

import org.springframework.transaction.annotation.Transactional;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

@Service
public class UserServiceImpl implements UserService {
    private final PasswordEncoder passwordEncoder;
    private final UserRepository userRepository;


    //  Constructor
    public UserServiceImpl(PasswordEncoder passwordEncoder, UserRepository userRepository) {
        this.passwordEncoder = passwordEncoder;
        this.userRepository = userRepository;
    }

    // User Register
    @Transactional
    @Override
    public User register(String email, String password) {
        String normalizedMail = normalizeEmail(email);
        if (userRepository.findByEmail(normalizedMail).isPresent()) {
            throw new EmailAlreadyRegisteredException("Email already registered: " + normalizedMail);
        }
        String encodedPassword = passwordEncoder.encode(password);

        return userRepository.save(new User(normalizedMail, encodedPassword));
    }

    // NormalizeMail (rm blank spaces + toLowerCase)
    private String normalizeEmail(String email){
        return email.trim().toLowerCase();
    }
}
