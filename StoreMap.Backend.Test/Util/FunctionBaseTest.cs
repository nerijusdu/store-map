﻿using System;
using System.Collections.Generic;
using System.Linq;
using System.Net;
using System.Threading.Tasks;
using System.Web.Http;
using FluentAssertions;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.Internal;
using Moq;
using NUnit.Framework;
using StoreMap.Backend.Logic.Interfaces;
using StoreMap.Backend.Test.Mocks;
using StoreMap.Backend.Util;
using StoreMap.Data.Dtos;
using StoreMap.Data.Enums;
using StoreMap.Data.Extensions;
using StoreMap.Data.Responses;

namespace StoreMap.Backend.Test.Util
{
    [TestFixture]
    public class FunctionBaseTest
    {
        private FunctionBase functionBase;
        private readonly Mock<IServiceProvider> serviceProviderMock = new Mock<IServiceProvider>();
        private readonly Mock<IUserService> userServiceMock = new Mock<IUserService>();

        [OneTimeSetUp]
        public void Setup()
        {
            functionBase = new FunctionBase(serviceProviderMock.Object, userServiceMock.Object);
        }

        private HttpRequest CreateHttoRequestWithAuth(string tokenValue)
        {
            var context = new DefaultHttpContext();
            context.Request.Headers["Authorization"] = tokenValue;
            return new DefaultHttpRequest(context);
        }

        [Test]
        public void FunctionBase_ShouldResolveCommand()
        {
            var commandObj = new MockCommand();
            serviceProviderMock
                .Setup(x => x.GetService(It.IsAny<Type>()))
                .Returns(commandObj);

            var result = functionBase.ResolveCommand<MockCommand>();

            result.Should().Be(commandObj);
        }

        [Test]
        public void FunctionBase_WhenCommandNotFound_ShouldThrowException()
        {
            serviceProviderMock
                .Setup(x => x.GetService(It.IsAny<Type>()))
                .Returns(null);

            functionBase
                .Invoking(x => x.ResolveCommand<MockCommand>())
                .Should().Throw<ApplicationException>();
        }
        
        [Test]
        public void FunctionBase_SafeExecute_ShouldCatchExceptions()
        {
            Func<Task<GenericResponse<object>>> action = () => throw new HttpResponseException(HttpStatusCode.BadRequest);
            functionBase
                .Invoking(x => x.SafeExecute(action))
                .Should().NotThrow();

            var result = functionBase.SafeExecute(action).Result;

            result.Should().BeOfType<StatusWithDataResult>();
        }

        [TestCase("Bearerwithnospace")]
        [TestCase(null)]
        public void FunctionBase_ValidateTokenAsync_ShouldHandleBadTokenStrings(string tokenValue)
        {
            userServiceMock.Reset();

            var request = CreateHttoRequestWithAuth(tokenValue);

            var result = functionBase.ValidateTokenAsync(request).Result;

            result.Should().BeNull();
            userServiceMock.Verify(x => x.GetUserData(It.IsAny<string>()), Times.Never);
        }
        
        [Test]
        public void FunctionBase_ValidateTokenAsync_WhenUserIsNull_ShouldThrowUnauthorized()
        {
            userServiceMock
                .Setup(x => x.GetUserData(It.IsAny<string>()))
                .Returns(Task.FromResult<UserData>(null));

            var request = CreateHttoRequestWithAuth("Bearer a");

            functionBase
                .Invoking(x => x.ValidateTokenAsync(request))
                .Should().ThrowExactlyAsync<HttpResponseException>();
        }
        
        [TestCaseSource(nameof(TokenTestData))]
        public void FunctionBase_ValidateTokenAsync_WhenTokensDontMatch_ShouldThrowForbidden(string role, UserRole allowedRoles, bool shouldThrow)
        {
            userServiceMock
                .Setup(x => x.GetUserData(It.IsAny<string>()))
                .Returns(Task.FromResult(new UserData
                {
                    Role = role
                }));

            var request = CreateHttoRequestWithAuth("Bearer a");

            var invoking = functionBase.Invoking(x => x.ValidateTokenAsync(request, allowedRoles));
            if (shouldThrow)
            {
                invoking.Should().ThrowExactlyAsync<HttpResponseException>();
            }
            else
            {
                invoking.Should().NotThrow();
            }
        }

        private static IEnumerable<TestCaseData> TokenTestData
        {
            get
            {
                yield return new TestCaseData(UserRole.User.GetRefCodes(), UserRole.User, false);
                yield return new TestCaseData(UserRole.User.GetRefCodes(), UserRole.Admin, true);
                yield return new TestCaseData(UserRole.User.GetRefCodes(), UserRole.AdminMod, true);
            }
        }
    }
}