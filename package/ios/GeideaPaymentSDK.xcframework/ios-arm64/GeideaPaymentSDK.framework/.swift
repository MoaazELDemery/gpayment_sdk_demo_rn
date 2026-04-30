//
//  CardAuthenticationUseCase 2.swift
//  GDPaymentSDK
//
//  Created by Ahmid Abdelwahab on 10/09/2025.
//


import Foundation
import GDNetworkManager
import SharedModels

@MainActor
public protocol CardPayUseCase {
    func execute(request: AuthenticationRequest) async throws -> AuthenticationResponse
}

final public class CardPayUseCaseImpl: CardPayUseCase {
    private var networkManager: GDNetworkManager
    
    public init(networkManager: GDNetworkManager) {
        self.networkManager = networkManager
    }
    
    public func execute(request: AuthenticationRequest) async throws -> AuthenticationResponse {
        let api: SDKAPI = SDKAPI.cardAuthentication(request: request)
        do {
            let response: AuthenticationResponse = try await networkManager.executeAPI(api)
            return response
        } catch {
            throw error
        }
    }
}
