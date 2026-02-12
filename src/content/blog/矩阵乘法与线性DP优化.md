---
title: 【线性代数】矩阵乘法与线性DP优化
tags:
  - 矩阵
  - DP
  - 线性代数
  - 优化
  - 矩阵快速幂
  - 快速幂
  - OI
categories:
  - 技术
  - OI学习笔记
  - 线性代数
abbrlink: "67047465"
pubDate: 2023-08-03 00:00:00
description: 矩阵乘法与线性DP优化，使用矩阵快速幂优化线性动态规划
---

## 前言

现在有一道题目如下：

> 输入一个整数 n ($n \leq 10^{18}$)， 求第 n 个斐波那契数。

众所周知斐波那契数列的递推公式是：$f_i = f_{i-1} + f_{i-2}$。通过$O(N)$的时间递推可以在 1s 内求出前 1e8 的斐波那契数，但是题目的范围是 1e18，这要怎么办呢？这时候就要引出我们今天要学习的内容——矩阵与矩阵乘法了。

## 概念

### 什么是矩阵（matrix）

下面是一个$2 \times 2$的矩阵，其中`a`，`b`，`c`，`d`，是里面的元素，矩阵里的元素可以是数字符号或者数学式。

$$\begin{bmatrix}{a} & {b} \\ {c} & {d}\end{bmatrix}$$

关于矩阵的其他内容我们不再延申，你现在只要知道矩阵是这么样的一个东西就可以了。

矩阵可以用字母代表，那么矩阵 $A_{n \times m}$ 本质上是一个 n 行 m 列的二维数组。

### 矩阵乘法

矩阵之间可以相乘，并且满足结合律与分配律——不满足交换律，在$n \times m(n \ne m)$这种不是`正方形`的矩阵中，交换前后两个矩阵相乘会导致结果矩阵的形状不同，我们会在后面解释。

> 矩阵相乘时，相乘矩阵的宽高必须有一个相同，否则无法配对。

比如下面这个式子，把矩阵$A \times B = C$，可以这样写：

$$ C*{n\times s}=A*{n\times m}\:\times B\_{m\times s} $$

那么它实际上就等于：

$$ C*{ij}=\sum A*{ik}\times B\_{kj}\left(1\:\le\:k\:\le\:m\right) $$

其中 k 的遍历过程也就是`相乘矩阵的宽高必须有一个相同`的原因，否则匹配不了。

写成代码形式，就和弗洛伊德很像，可以把弗洛伊德看成是魔改的矩阵乘法：

```cpp
for(int i = 1; i <= an; i++)
    for(int k = 1; k <= am; k++)
        for(int j = 1; j <= bm; j++)
            c[i][j] = c[i][j] + a[i][k] * b[k][j];
```

## 用矩阵优化线性 DP

回到前言我们说的题目，这里回顾一下：

> 输入一个整数 n ($n \leq 10^{18}$)， 求第 n 个斐波那契数。

我们每一次转移可以用一个矩阵表示：

$$ \left[{f_{i-1}},\:f_{i-2}\right]\times\left[\begin{matrix}{1} & {1} \\ {1} & {0}\end{matrix}\right]=\left[{f_i},\:f_{i-1}\right] $$

因为是线性的，所以我们很容易发现，每一转移其实就是当前的状态矩阵乘上我们的$\left[\begin{matrix}{1} & {1} \\ {1} & {0}\end{matrix}\right]$，那么每转移一次，i 就加一，我们先处理出$f_1,f_2$，那么通过$n-2$次转移，我们就可以得到$f_n$的值。

### 延伸

所有类似于这样的线性 DP 都可以用矩阵来转移，比如$f_i = f_{i-1} + f_{i-3} + f_{i-4}$，这种转移，我们可以构造下面这一个转移矩阵：

$$ \begin{bmatrix}1 & 0 & 0 & 0 \\ 0 & 1 & 0 & 0 \\ 1 & 0 & 1 & 0 \\ 1 & 0 & 0 & 1\end{bmatrix} $$

然后使用快速幂可以把时间复杂度从$O(N)$优化到$O(k^3 \log N)$ ，其中 k 是状态是数量，也就是转移矩阵的边长。

下面是实例代码，可以解决$f_i = f_{i-1} + f_{i-3} + f_{i-4}$求解$f_n$并且$n \leq 10^{18}$的情况。

> 这里因为乘的顺序不一样（交换了），矩阵不能使用交换律，所以转移矩阵稍有不同。（实际上一般情况下习惯把系数放在第一行，也就是代码中转移矩阵的样子）

```cpp
#include <iostream>
#include <cstdio>
#include <vector>
using namespace std;

typedef long long ll;
typedef vector<vector<ll>> matrix;

matrix multiply(matrix a, matrix b, ll mod)
{
    ll n = a.size();
    matrix c(n, vector<ll>(n));
    for (ll i = 0; i < n; i++)
        for (ll j = 0; j < n; j++)
            for (ll k = 0; k < n; k++)
                c[i][j] = (c[i][j] + a[i][k] * b[k][j]) % mod;
    return c;
}

matrix matrix_pow(matrix a, ll n, ll mod)
{
    ll m = a.size();
    matrix res(m, vector<ll>(m));
    for (ll i = 0; i < m; i++)
        res[i][i] = 1;
    while (n)
    {
        if (n & 1)
            res = multiply(res, a, mod);
        a = multiply(a, a, mod);
        n >>= 1;
    }
    return res;
}

int main()
{
    matrix a = {{1, 0, 1, 1},
                {1, 0, 0, 0},
                {0, 1, 0, 0},
                {0, 0, 1, 0}}; // 转移矩阵
    ll n;
    scanf("%lld", &n); // 2, 4, 6, 9
    matrix ans = matrix_pow(a, n - 4, 10007);
    printf("%lld", (ll)(2 * ans[0][3] + 4 * ans[0][2] + 6 * ans[0][1] + 9 * ans[0][0]) % 10007);
    return 0;
}
```
